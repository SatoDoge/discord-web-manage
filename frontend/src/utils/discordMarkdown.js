function escapeHtml(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function applyInlineMarkdown(text) {
    let html = text;

    html = html.replace(/\|\|(.+?)\|\|/g, '<span class="discord-spoiler">$1</span>');
    html = html.replace(/```([\s\S]*?)```/g, '<pre class="discord-codeblock"><code>$1</code></pre>');
    html = html.replace(/`([^`\n]+)`/g, '<code class="discord-inline-code">$1</code>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.+?)__/g, '<u>$1</u>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/_(.+?)_/g, '<em>$1</em>');
    html = html.replace(/~~(.+?)~~/g, '<s>$1</s>');
    html = html.replace(
        /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    );
    html = html.replace(
        /(https?:\/\/[^\s<]+)/g,
        '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
    );
    html = html.replace(/&lt;@!?(\d{17,20})&gt;/g, '<span class="discord-mention">@user</span>');
    html = html.replace(/&lt;#(\d{17,20})&gt;/g, '<span class="discord-mention">#channel</span>');
    html = html.replace(/&lt;@&amp;(\d{17,20})&gt;/g, '<span class="discord-mention">@role</span>');

    return html;
}

/**
 * Render a Discord-style markdown preview from plain text.
 */
export function renderDiscordMarkdown(content) {
    if (!content?.trim()) {
        return '';
    }

    const lines = escapeHtml(content).split('\n');
    const blocks = [];
    let quoteLines = [];

    function flushQuote() {
        if (!quoteLines.length) {
            return;
        }
        blocks.push(
            `<blockquote class="discord-quote">${quoteLines.map((line) => applyInlineMarkdown(line)).join('<br />')}</blockquote>`
        );
        quoteLines = [];
    }

    for (const line of lines) {
        if (line.startsWith('&gt; ')) {
            quoteLines.push(line.slice(5));
            continue;
        }
        if (line === '&gt;') {
            quoteLines.push('');
            continue;
        }

        flushQuote();
        blocks.push(`<p class="discord-paragraph">${applyInlineMarkdown(line) || '&nbsp;'}</p>`);
    }

    flushQuote();
    return blocks.join('');
}
