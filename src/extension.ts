// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import path = require('path');
import * as vscode from 'vscode';
import * as sharp from 'sharp';
import * as fs from 'fs';
import * as crypto from 'crypto';

function log(message: string) {
	//utc timestapmp
	const timestamp = new Date().toISOString();
	console.log(`${timestamp} - [markdown-paste-image]${message}`);
}

function err(message: string) {
	const timestamp = new Date().toISOString();
	console.error(`${timestamp} - [markdown-paste-image]${message}`);
}

async function pasteImage(context: vscode.ExtensionContext, folderPath: string) {

	try {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage('No active editor found');
			return;
		}
		const fileNameAndAlt = await askFileName();
		if (fileNameAndAlt === null) { return; }
		//get relative path
		const mdPath = editor.document.uri.fsPath;

		const panel = await createImagePastePanel();
		let fileExtension: string;
		let imagePath: string;
		await panel.webview.onDidReceiveMessage(
			async (message) => {
				if (message.type === 'image') {
					const base64data = message.data.replace(/^data:image\/\w+;base64,/, '');
					fileExtension = message.data.substring(message.data.indexOf('/') + 1, message.data.indexOf(';'));
					const buffer = Buffer.from(base64data, 'base64');
					const image = sharp(buffer);

					const mdName = mdPath.substring(mdPath.lastIndexOf('/') + 1, mdPath.length);
					const currentFolder = mdPath.replace(new RegExp(mdName + '$'), '');
					const mdNameWithoutExtension = mdName.substring(0, mdName.lastIndexOf('.'));
					const outpath = path.join(currentFolder, mdNameWithoutExtension + '/');

					await saveImageToFolder(image, outpath, fileNameAndAlt.filename + '.' + fileExtension);
					const relativePath = `./${mdNameWithoutExtension}/${fileNameAndAlt.filename}.${fileExtension}`;
					panel.dispose(); // Close the webview panel
					await insertImageToMarkdown(editor, relativePath, fileNameAndAlt.altText);

				} else if (message.type === 'debug') {
					log(`[webview] ${message.data}`);
				} else if (message.type === 'error') {
					err(`[webview] ${message.data}`);
					vscode.window.showErrorMessage(message.data);
					panel.dispose();
				}
			},
			undefined,
			context.subscriptions
		);
	} catch (error: any) {
		err(error.message);
		vscode.window.showErrorMessage(`Error: ${error.message}`);
	}
}


async function saveImageToFolder(image: sharp.Sharp, folderPath: string, imageName: string) {
	//if folder not exist create it
	try {
		await vscode.workspace.fs.stat(vscode.Uri.file(folderPath));
	} catch (error) {
		//create 
		log(`Creating folder ${folderPath}`);
		await vscode.workspace.fs.createDirectory(vscode.Uri.file(folderPath));
	}
	const imagePath = path.join(folderPath, imageName);
	await image.toFile(imagePath);

	return;
}

async function insertImageToMarkdown(editor: vscode.TextEditor, imagePath: string, altText: string) {
	if (editor) {
		const imageMarkdown = `![${altText}](${imagePath})`;
		//reforcus editor
		// Refocus the editor
		const focusedEditor = await vscode.window.showTextDocument(editor.document, { preview: false, viewColumn: editor.viewColumn })
		focusedEditor.edit((editBuilder) => {
			editBuilder.insert(focusedEditor.selection.active, imageMarkdown);
		});
	} else {
		vscode.window.showErrorMessage('No active editor found');
	}
}


// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	log('Congratulations, your extension "markdown-paste-image" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('markdown-paste-image.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from markdown-paste-image!');
	});

	context.subscriptions.push(disposable);
	context.subscriptions.push(
		vscode.commands.registerCommand('markdown-paste-image.clipIt', async () => {
			//get file which is active
			const editor = vscode.window.activeTextEditor;
			if (!editor) {
				vscode.window.showInformationMessage('No editor is active');
				return;
			}
			const path = editor.document.uri.fsPath;

			const currentFolder = path.substring(0, path.lastIndexOf('/'));
			pasteImage(context, currentFolder);

		})
	);
}

async function createImagePastePanel() {
	const panel = vscode.window.createWebviewPanel(
		'imagePaste',
		'Paste Image',
		vscode.ViewColumn.One,
		{
			enableScripts: true,
		}
	);
	const nonce = getBase64Nonce();
	const html = (await getWebviewContent());//.replace(/\$\{nonce\}/g, nonce);;
	panel.webview.html = html;
	return panel;
}

function getBase64Nonce() {
	const nonce = new Uint8Array(32);
	crypto.randomFillSync(nonce);
	return Buffer.from(nonce).toString('base64');
}


function getWebviewContent() {
	const filePath = path.join(__dirname, 'webview.html');
	return fs.promises.readFile(filePath, 'utf8');
}


async function askFileName(): Promise<{ filename: string, altText: string } | null> {
	const inputFileName = await vscode.window.showInputBox({
		prompt: 'enter file name',
		placeHolder: 'image'
	});

	if (null === inputFileName) {
		return null;
	}

	let inputAltText = await vscode.window.showInputBox({
		prompt: 'enter alt text'
	});

	if (null === inputAltText || undefined === inputAltText) {
		return null;
	}

	const filename = inputFileName === '' ? inputFileName : 'image';

	return { filename: filename, altText: inputAltText };
}
