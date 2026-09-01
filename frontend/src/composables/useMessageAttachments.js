import { computed, onBeforeUnmount, ref } from 'vue';

const MAX_ATTACHMENTS = 10;
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

function formatFileSize(bytes) {
    if (bytes < 1024) {
        return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageFile(file) {
    return file.type.startsWith('image/');
}

function createAttachmentEntry(file) {
    const entry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        previewUrl: isImageFile(file) ? URL.createObjectURL(file) : null
    };
    return entry;
}

export function useMessageAttachments() {
    const attachments = ref([]);

    const attachmentCount = computed(() => attachments.value.length);
    const hasAttachments = computed(() => attachmentCount.value > 0);

    function revokePreview(entry) {
        if (entry?.previewUrl) {
            URL.revokeObjectURL(entry.previewUrl);
        }
    }

    function addFiles(files) {
        const incoming = Array.from(files ?? []).filter((file) => file instanceof File && file.size > 0);
        if (!incoming.length) {
            return { ok: false, error: 'empty' };
        }

        const availableSlots = MAX_ATTACHMENTS - attachments.value.length;
        if (availableSlots <= 0) {
            return { ok: false, error: 'too_many_attachments' };
        }

        const accepted = [];
        for (const file of incoming.slice(0, availableSlots)) {
            if (file.size > MAX_ATTACHMENT_BYTES) {
                return { ok: false, error: 'attachment_too_large' };
            }
            accepted.push(createAttachmentEntry(file));
        }

        attachments.value = [...attachments.value, ...accepted];
        if (incoming.length > availableSlots) {
            return { ok: true, truncated: true };
        }
        return { ok: true, truncated: false };
    }

    function removeAttachment(id) {
        const index = attachments.value.findIndex((entry) => entry.id === id);
        if (index === -1) {
            return;
        }
        const [removed] = attachments.value.splice(index, 1);
        revokePreview(removed);
        attachments.value = [...attachments.value];
    }

    function clearAttachments() {
        for (const entry of attachments.value) {
            revokePreview(entry);
        }
        attachments.value = [];
    }

    function handlePaste(event) {
        const items = event.clipboardData?.items;
        if (!items?.length) {
            return false;
        }

        const files = [];
        for (const item of items) {
            if (item.kind === 'file') {
                const file = item.getAsFile();
                if (file) {
                    files.push(file);
                }
            }
        }

        if (!files.length) {
            return false;
        }

        event.preventDefault();
        return addFiles(files);
    }

    onBeforeUnmount(() => {
        clearAttachments();
    });

    return {
        attachments,
        attachmentCount,
        hasAttachments,
        maxAttachments: MAX_ATTACHMENTS,
        addFiles,
        removeAttachment,
        clearAttachments,
        handlePaste,
        formatFileSize,
        isImageFile
    };
}
