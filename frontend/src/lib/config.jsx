import { createContext, useContext, useEffect, useState } from "react";
import { api } from "./api";

const defaults = { card_payments: false, shipping_fee: "9.99", free_shipping_over: "100", max_quantity: 10 };
const ConfigContext = createContext(defaults);

/* Store settings (shipping fee, whether card payments are on) come from the API */
export function ConfigProvider({ children }) {
  const [config, setConfig] = useState(defaults);
  useEffect(() => {
    api("/config/", { auth: false }).then(setConfig).catch(() => {});
  }, []);
  return <ConfigContext.Provider value={config}>{children}</ConfigContext.Provider>;
}

export const useConfig = () => useContext(ConfigContext);

export const shippingFor = (subtotal, config) =>
  subtotal >= Number(config.free_shipping_over) ? 0 : Number(config.shipping_fee);
