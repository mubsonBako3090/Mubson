"use client";

import { formatNaira } from "@/utils/formatNaira";
import styles from "./RequisitionItemsTable.module.css";

// `items` is [{ name, quantity, unitCost }]. Fully controlled by parent.
export default function RequisitionItemsTable({ items, onChange, readOnly = false }) {
  function updateItem(index, field, value) {
    const next = items.map((item, i) => (i === index ? { ...item, [field]: value } : item));
    onChange(next);
  }

  function addItem() {
    onChange([...items, { name: "", quantity: 1, unitCost: 0 }]);
  }

  function removeItem(index) {
    onChange(items.filter((_, i) => i !== index));
  }

  const total = items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitCost || 0), 0);

  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Item</th>
            <th>Qty</th>
            <th>Unit Cost (₦)</th>
            <th>Total</th>
            {!readOnly && <th></th>}
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i}>
              <td>
                {readOnly ? (
                  item.name
                ) : (
                  <input
                    className={styles.cellInput}
                    value={item.name}
                    onChange={(e) => updateItem(i, "name", e.target.value)}
                    placeholder="e.g. A4 paper (ream)"
                  />
                )}
              </td>
              <td>
                {readOnly ? (
                  item.quantity
                ) : (
                  <input
                    type="number"
                    min={1}
                    className={styles.cellInputSmall}
                    value={item.quantity}
                    onChange={(e) => updateItem(i, "quantity", Number(e.target.value))}
                  />
                )}
              </td>
              <td>
                {readOnly ? (
                  formatNaira(item.unitCost)
                ) : (
                  <input
                    type="number"
                    min={0}
                    className={styles.cellInputSmall}
                    value={item.unitCost}
                    onChange={(e) => updateItem(i, "unitCost", Number(e.target.value))}
                  />
                )}
              </td>
              <td className="mono">{formatNaira(Number(item.quantity || 0) * Number(item.unitCost || 0))}</td>
              {!readOnly && (
                <td>
                  <button type="button" className={styles.removeBtn} onClick={() => removeItem(i)}>
                    <i className="bi bi-trash" />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {!readOnly && (
        <button type="button" className={styles.addBtn} onClick={addItem}>
          <i className="bi bi-plus-lg" /> Add item
        </button>
      )}

      <div className={styles.totalRow}>
        <span>Estimated Total</span>
        <span className="mono">{formatNaira(total)}</span>
      </div>
    </div>
  );
}
