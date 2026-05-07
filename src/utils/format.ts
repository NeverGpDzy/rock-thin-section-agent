export const formatDateTime = (value: string | null | undefined) => {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
};

export const formatFileSize = (bytes: number | null | undefined) => {
  if (!bytes && bytes !== 0) {
    return "-";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const formatPercent = (value: number | null | undefined) => {
  if (value === null || value === undefined) {
    return "-";
  }

  return `${(value * 100).toFixed(1)}%`;
};

export const formatConfidence = (value: number | null | undefined) => {
  if (value === null || value === undefined) {
    return "-";
  }

  return `${(value * 100).toFixed(1)}%`;
};
