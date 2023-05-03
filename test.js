async function getImageFromClipboard() {
    Log("getImageFromClipboard");
    try {
        const items = await navigator.clipboard.read();
        Log("Clipboard read");

        for (const item of items) {
            for (const type of item.types) {
                if (type === 'image/png' || type === 'image/jpeg') {
                    const blob = await item.getType(type);
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
                }
            }
        }
    } catch (err) {
        Log(err.message);
    }
}
document.getElementById("paste-image").onclick = await getImageFromClipboard();

