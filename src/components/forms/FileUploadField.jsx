"use client";

import { useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { ACCEPTED_UPLOAD_TYPES } from "@/constants/requisitionOptions";
import styles from "./FileUploadField.module.css";

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function FileUploadField({ requisitionId, attachments = [], onUploaded }) {
  const [uploading, setUploading] = useState(false);

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED_UPLOAD_TYPES.includes(file.type)) {
      toast.error("Only PDF, image, and Word documents are supported.");
      return;
    }

    setUploading(true);
    try {
      const fileBase64 = await fileToBase64(file);
      const { data } = await axios.post("/api/upload", {
        requisitionId,
        fileName: file.name,
        fileType: file.type,
        fileBase64,
      });
      onUploaded(data.requisition.attachments);
      toast.success("File uploaded.");
    } catch (err) {
      toast.error(err.response?.data?.message || "Upload failed.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div className={styles.wrapper}>
      <label className={styles.uploadBtn}>
        <i className="bi bi-paperclip" />
        {uploading ? "Uploading…" : "Attach supporting document"}
        <input
          type="file"
          accept=".pdf,image/*,.doc,.docx"
          className={styles.hiddenInput}
          onChange={handleFileChange}
          disabled={uploading}
        />
      </label>

      {attachments.length > 0 && (
        <ul className={styles.fileList}>
          {attachments.map((a) => (
            <li key={a.publicId} className={styles.fileItem}>
              <i className="bi bi-file-earmark" />
              <a href={a.url} target="_blank" rel="noreferrer">
                {a.fileName}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
