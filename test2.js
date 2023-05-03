async function getImageFromClipboard() {
    Log("getImageFromClipboard");
    try {
        navigator.clipboard.read().then(items => {
            Log("Clipboard read");

            for (const item of items) {
                for (const type of item.types) {
                    if (type === 'image/png' || type === 'image/jpeg') {
                        item.getType(type).then(blob => {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                                const base64data = reader.result;
                                vscode.postMessage({
                                    type: 'image',
                                    data: base64data,
                                });
                            };
                            reader.readAsDataURL(blob);
                            return;
                        });
                    }
                }
            }
        });
    } catch (err) {
        Log(err.message);
    }
}
document.getElementById("paste-image").onclick = getImageFromClipboard();
