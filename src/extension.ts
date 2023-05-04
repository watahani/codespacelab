// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import path = require('path');
import * as vscode from 'vscode';
import * as sharp from 'sharp';
import { fstat } from 'fs';

async function pasteImage(context: vscode.ExtensionContext, folderPath: string) {

	try {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage('No active editor found');
			return;
		}
		const fileNameAndAlt = await askFileName();
		//get relative path
		const filepath = editor.document.uri.fsPath;

		const panel = createImagePastePanel();
		let fileExtension: string;
		let imagePath: string;
		await panel.webview.onDidReceiveMessage(
			async (message) => {
				if (message.type === 'image') {
					const base64data = message.data.replace(/^data:image\/\w+;base64,/, '');
					fileExtension = message.data.substring(message.data.indexOf('/') + 1, message.data.indexOf(';'));
					const buffer = Buffer.from(base64data, 'base64');
					const image = sharp(buffer);

					const filename = filepath.substring(filepath.lastIndexOf('/') + 1, filepath.length);
					const currentFolder = filepath.replace(new RegExp(filename + '$'), '');
					const filenameWithoutExtension = filename.substring(0, filename.lastIndexOf('.'));
					const outpath = path.join(currentFolder, filenameWithoutExtension + '/');
					
					await saveImageToFolder(image, outpath, fileNameAndAlt.filename + '.' + fileExtension);
					const relativePath = `./${filenameWithoutExtension}/${fileNameAndAlt.filename}.${fileExtension}`;
					panel.dispose(); // Close the webview panel
					await insertImageToMarkdown(editor, relativePath, fileNameAndAlt.altText);

				} else if (message.type === 'debug') {
					console.log(`webview log: ${message.data}`);
				}
			},
			undefined,
			context.subscriptions
		);
		


	} catch (error: any) {
		vscode.window.showErrorMessage(`Error: ${error.message}`);
	}
}

async function saveImageToFolder(image: sharp.Sharp, folderPath: string, imageName: string) {
	//if folder not exist create it
	try {
		await vscode.workspace.fs.stat(vscode.Uri.file(folderPath));
	} catch (error) {
		//create folder
		await vscode.workspace.fs.createDirectory(vscode.Uri.file(folderPath));
	}
	const imagePath = path.join(folderPath, imageName);
	await image.toFile(imagePath);

	return imagePath;
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
	}
}


// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "markdown-paste-image" is now active!');

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

function createImagePastePanel() {
	const panel = vscode.window.createWebviewPanel(
		'imagePaste',
		'Paste Image',
		vscode.ViewColumn.One,
		{
			enableScripts: true,
		}
	);

	panel.webview.html = getWebviewContent();
	return panel;
}


function getWebviewContent() {
	return `
	<!DOCTYPE html>
	<html lang="en">
	<head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; script-src 'nonce-xyz';"
/>
		<title>My Webview</title>
	</head>
		<body>
			<button id="paste-image">Paste Image</button>
			<button id="debug">debug</button>
			<div id="debug-view"></div>
			<script nonce="xyz">
			const  vscode = acquireVsCodeApi();
			function Log(message) {
				vscode.postMessage({
					type: 'debug',
					data: message,
				});
			}
			Log("Web View opened");
			document.getElementById("debug").onclick= () => { 
				Log("debug on click");  
				document.getElementById("debug-view").innerHTML = "debug on click1";
			}
			// https://dirask.com/posts/JavaScript-read-image-from-clipboard-as-Data-URLs-encoded-with-Base64-10Wwaj
			var clipboardUtils = new function() {
				var permissions = {
					'image/bmp': true,
					'image/gif': true,
					'image/png': true,
					'image/jpeg': true,
					'image/tiff': true
				};
			
				function getType(types) {
					for (var j = 0; j < types.length; ++j) {
						var type = types[j];
						if (permissions[type]) {
							return type;
						}
					}
					return null;
				}
				function getItem(items) {
					for (var i = 0; i < items.length; ++i) {
						var item = items[i];
						if(item) {
							var type = getType(item.types);
							if(type) {
								return item.getType(type);
							}
						}
					}
					return null;
				}
				function loadFile(file, callback) {
					if (window.FileReader) {
						var reader = new FileReader();
						reader.onload = function() {
							callback(reader.result, null);
						};
						reader.onerror = function() {
							callback(null, 'Incorrect file.');
						};
						reader.readAsDataURL(file);
					} else {
						callback(null, 'File api is not supported.');
					}
				}
				Log("dev")
				this.readImage = function(callback) {
					if (navigator.clipboard) {
						var promise = navigator.clipboard.read();
						promise
							.then(function(items) {
								var promise = getItem(items);
								if (promise == null) {
									callback(null, null);
									return;
								}
								promise
									.then(function(result) {
										loadFile(result, callback);
									})
									.catch(function(error) {
										callback(null, 'Reading clipboard error.');
									});
							})
							.catch(function(error) {
								console.error(error)
								callback(null, 'Reading clipboard error.');
							});
					} else {
						callback(null, 'Clipboard is not supported.');
					}
				};
			};
			document.getElementById('paste-image').addEventListener('click',  () => {
				clipboardUtils.readImage(function(data, error) {
					Log("readImage");
					if (error) {
						Log(error);
						return;
					}
					if (data) {
						vscode.postMessage({
							type: 'image',
							data: data,
						});
					}
				});
			});			
			</script>
		</body>
	</html>
	`;
}


async function askFileName(): Promise<{ filename: string, altText: string }> {
	const filename = await vscode.window.showInputBox({
		prompt: 'enter file name'
	});

	const altText = await vscode.window.showInputBox({
		prompt: 'enter alt text'
	});
	if (!filename || !altText) { throw new Error('filename or altText is empty'); }
	return { filename: filename, altText: altText };
}
