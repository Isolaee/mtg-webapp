import React from "react";
import AdSlot from "./AdSlot";
import { T } from "../theme";

// Replace YOURUSERNAME with your Ko-Fi username
const KOFI_URL = "https://ko-fi.com/YOURUSERNAME";
const SLOT_ID_FOOTER = "XXXXXXXXXX"; // replace with AdSense footer ad unit slot ID

const Footer: React.FC = () => (
  <footer
    style={{
      borderTop: `1px solid ${T.border}`,
      marginTop: "3em",
      padding: "1.5em 1.5em 2em",
      maxWidth: 1200,
      margin: "3em auto 0",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "1em",
    }}
  >
    <AdSlot slotId={SLOT_ID_FOOTER} />
    <a
      href={KOFI_URL}
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: T.gold, fontSize: 13, textDecoration: "none" }}
    >
      ♥ Support TCG Builder on Ko-Fi
    </a>
    <p style={{ color: T.textDim, fontSize: 11, margin: 0 }}>
      © {new Date().getFullYear()} TCG Builder
    </p>
  </footer>
);

export default Footer;
