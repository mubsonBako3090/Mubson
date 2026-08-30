"use client";

import { formatNaira } from "@/utils/formatNaira";
import styles from "./RequisitionItemsTable.module.css";

function unitKey(unit) {
  return [unit.collegeId, unit.facultyId, unit.department].join("|");
}

function itemUnitKey(item) {
  return [
    item.requestingCollegeId || "",
    item.requestingFacultyId || "",
    item.requestingDepartment || "",
  ].join("|");
}

// `items` is [{ name, quantity, unitCost, requestingCollegeId?, requestingFacultyId?, requestingDepartment? }].
// `requestingUnits` is the list picked in Step 1 — when there's more than one,
// each item must be tagged with which one it belongs to.
// `selectable`/`selectedIndexes`/`onToggleSelect` add an optional checkbox
// column (used on the approval page to split off specific items).
export default function RequisitionItemsTable({
  items,
  requestingUnits,
  onChange,
  readOnly = false,
  selectable = false,
  selectedIndexes,
  onToggleSelect,
}) {
  const units = requestingUnits || [];
  const showDepartmentColumn = units.length > 1;
  const selected = selectedIndexes || new Set();

  function updateItem(index, field, value) {
    const next = items.map((item, i) => (i === index ? { ...item, [field]: value } : item));
    onChange(next);
  }

  function updateItemUnit(index, key) {
    const unit = units.find((u) => unitKey(u) === key);

    const next = items.map((item, i) =>
      i === index
        ? {
            ...item,
            requestingCollegeId: unit?.collegeId || "",
            requestingFacultyId: unit?.facultyId || "",
            requestingDepartment: unit?.department || "",
          }
        : item
    );

    onChange(next);
  }

  function addItem() {
    const soloUnit = units.length === 1 ? units[0] : null;

    onChange([
      ...items,
      {
        name: "",
        quantity: 1,
        unitCost: 0,
        requestingCollegeId: soloUnit?.collegeId || "",
        requestingFacultyId: soloUnit?.facultyId || "",
        requestingDepartment: soloUnit?.department || "",
      },
    ]);
  }

  function removeItem(index) {
    onChange(items.filter((_, i) => i !== index));
  }

  function labelForUnit(unit) {
    return unit.department;
  }

  const total = items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitCost || 0), 0);

  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            {selectable && <th></th>}
            <th>Item</th>
            {showDepartmentColumn && <th>Department</th>}
            <th>Qty</th>
            <th>Unit Cost (₦)</th>
            <th>Total</th>
            {!readOnly && <th></th>}
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i}>
              {selectable && (
                <td>
                  <input
                    type="checkbox"
                    checked={selected.has(i)}
                    onChange={() => onToggleSelect(i)}
                  />
                </td>
              )}
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
              {showDepartmentColumn && (
                <td>
                  {readOnly ? (
                    item.requestingDepartment || "-"
                  ) : (
                    <select
                      className={styles.cellInput}
                      value={itemUnitKey(item)}
                      onChange={(e) => updateItemUnit(i, e.target.value)}
                    >
                      <option value="">Select department</option>
                      {units.map((unit) => (
                        <option key={unitKey(unit)} value={unitKey(unit)}>
                          {labelForUnit(unit)}
                        </option>
                      ))}
                    </select>
                  )}
                </td>
              )}
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
