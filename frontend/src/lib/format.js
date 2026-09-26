const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
export const formatPrice = (value) => money.format(Number(value));

export const formatDate = (iso) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
