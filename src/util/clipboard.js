export function writeToClipboard(text) {
	if (navigator.clipboard && navigator.clipboard.writeText) {
		return navigator.clipboard.writeText(text);
	}

	var textArea = document.createElement('textarea');
	textArea.value = text;
	textArea.setAttribute('readonly', '');
	textArea.style.position = 'fixed';
	textArea.style.left = '-999999px';
	textArea.style.top = '0';
	document.body.appendChild(textArea);
	textArea.focus();
	textArea.select();

	var ok = false;

	try {
		ok = document.execCommand('copy');
	}
	catch (e) {
		ok = false;
	}

	document.body.removeChild(textArea);

	if (ok) {
		return Promise.resolve();
	}

	return Promise.reject(new Error('Clipboard write failed'));
}
