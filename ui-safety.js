'use strict';
class HTMLValue {
    constructor(value) {
        this.value = value;
    }
    toString() {
        return this.value;
    }
}
function escapeHTML(value) {
    return String(value ?? '').replace(
        /[&<>"']/g,
        (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
}
// Only literal markup and already-escaped template compositions use this helper.
function trustedHTML(value) {
    return new HTMLValue(String(value ?? ''));
}
function renderHTML(strings, ...values) {
    let result = strings[0];
    values.forEach((value, index) => {
        if (value instanceof HTMLValue) result += value.value;
        else {
            let text = String(value ?? '');
            // Legacy inline handlers contain quoted IDs. Escape for both JS and HTML contexts.
            if (
                /\bon\w+\s*=\s*"[^"]*$/.test(result) &&
                result.endsWith("'") &&
                strings[index + 1].startsWith("'")
            ) {
                text = text
                    .replace(/\\/g, '\\\\')
                    .replace(/'/g, "\\'")
                    .replace(/\r/g, '\\r')
                    .replace(/\n/g, '\\n')
                    .replace(/\u2028/g, '\\u2028')
                    .replace(/\u2029/g, '\\u2029');
            }
            result += escapeHTML(text);
        }
        result += strings[index + 1];
    });
    return new HTMLValue(result);
}
function printRegion(id, thermal = false) {
    const source = document.getElementById(id);
    if (!source) return;
    document.getElementById('print-root')?.remove();
    const root = document.createElement('section');
    root.id = 'print-root';
    root.dataset.thermal = String(thermal);
    const clone = source.cloneNode(true);
    clone.removeAttribute('id');
    clone.className = '';
    clone.querySelectorAll('button,input[type="checkbox"],.no-print').forEach((el) => el.remove());
    clone.querySelectorAll('input,select,textarea').forEach((el) => {
        const text = document.createElement('span');
        text.textContent = el.value;
        el.replaceWith(text);
    });
    // Canvas pixels are not copied by cloneNode.
    const originals = source.querySelectorAll('canvas');
    clone.querySelectorAll('canvas').forEach((canvas, i) => {
        const image = document.createElement('img');
        image.src = originals[i].toDataURL();
        canvas.replaceWith(image);
    });
    root.appendChild(clone);
    document.body.appendChild(root);
    window.print();
}
window.addEventListener('afterprint', () => document.getElementById('print-root')?.remove());
