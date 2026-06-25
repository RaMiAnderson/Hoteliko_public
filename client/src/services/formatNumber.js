export const formatNumber = (value) => {
	if (value === null || value === undefined) return "";

	const num = Number(value);
	if (Number.isNaN(num)) return value;

	return num % 1 === 0 ? num.toString() : num.toString();
};

export const formatDateForMySQL = (date) => {
  return date.toISOString().split("T")[0];
};

export function formatNumberWithSpace(value) {
    if (value === null || value === undefined) return "0";

    const number = Number(
        String(value).replace(/\s/g, "")
    );

    if (isNaN(number)) return "0";

    return number.toLocaleString("fr-FR").replace(/\u202f/g, " ");
}


