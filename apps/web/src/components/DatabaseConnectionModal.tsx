"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import type { DatabaseNodePayload } from "../lib/databaseNodeTypes";
import {
  testDatabaseConnection,
  createDatabaseConnection,
  updateDatabaseConnection,
} from "../lib/postgresClient";

type DatabaseConnectionModalProps = {
  isOpen: boolean;
  onClose: () => void;
  initialPayload: DatabaseNodePayload;
  workspaceId: string;
  onSave: (payload: DatabaseNodePayload) => void;
};

// Default values for a new database connection
const getDefaultPayload = (): DatabaseNodePayload => ({
  connectionName: "New Database",
  host: "",
  port: 5432,
  database: "",
  username: "",
  password: "",
  ssl: false,
  status: "idle",
});

export function DatabaseConnectionModal({
  isOpen,
  onClose,
  initialPayload,
  workspaceId,
  onSave,
}: DatabaseConnectionModalProps) {
  const [formData, setFormData] = useState<DatabaseNodePayload>(getDefaultPayload());
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message?: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      // For new connections (without connectionId), always use default values
      // For existing connections, use the payload data
      if (!initialPayload.connectionId) {
        setFormData(getDefaultPayload());
      } else {
        setFormData(initialPayload);
      }
      setTestResult(null);
      setError(null);
    }
  }, [isOpen, initialPayload]);

  if (!isOpen) return null;

  const handleTest = async () => {
    if (!formData.host || !formData.database || !formData.username) {
      setError("Please fill in required fields");
      return;
    }

    setIsTesting(true);
    setError(null);
    setTestResult(null);

    try {
      const result = await testDatabaseConnection({
        host: formData.host,
        port: formData.port,
        database: formData.database,
        username: formData.username,
        password: formData.password || "",
        ssl: formData.ssl,
      });

      setTestResult(result);
      if (result.success) {
        setFormData((prev) => ({
          ...prev,
          status: "connected",
          lastTestedAt: new Date().toISOString(),
        }));
      } else {
        setFormData((prev) => ({
          ...prev,
          status: "error",
          lastTestedAt: new Date().toISOString(),
        }));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Connection test failed";
      setError(message);
      setTestResult({ success: false, message });
      setFormData((prev) => ({
        ...prev,
        status: "error",
        lastTestedAt: new Date().toISOString(),
      }));
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    if (!formData.host || !formData.database || !formData.username) {
      setError("Please fill in required fields");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      let connectionId = formData.connectionId;
      let secretId = formData.secretId;

      if (!connectionId) {
        // Create new connection
        const result = await createDatabaseConnection({
          workspaceId,
          connectionName: formData.connectionName,
          host: formData.host,
          port: formData.port,
          database: formData.database,
          username: formData.username,
          password: formData.password || "",
          ssl: formData.ssl,
        });
        connectionId = result.connectionId;
        secretId = result.secretId;
      } else {
        // Update existing connection
        await updateDatabaseConnection(connectionId, {
          connectionName: formData.connectionName,
          host: formData.host,
          port: formData.port,
          database: formData.database,
          username: formData.username,
          password: formData.password || undefined,
          ssl: formData.ssl,
        });
      }

      const updatedPayload: DatabaseNodePayload = {
        ...formData,
        connectionId,
        secretId,
        password: undefined, // Never persist password in payload
        status: testResult?.success ? "connected" : formData.status || "idle",
      };

      onSave(updatedPayload);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save connection";
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (!isTesting && !isSaving) {
      onClose();
    }
  };

  const modal = (
    <div
      className="fixed inset-0 z-[100000] flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Database Connection</h2>
          <p className="mt-1 text-sm text-slate-500">Configure PostgreSQL connection settings</p>
        </div>

        <div className="px-6 py-4 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
              {error}
            </div>
          )}

          {testResult && (
            <div
              className={`rounded-lg border px-3 py-2 text-sm ${
                testResult.success
                  ? "border-emerald-200 bg-emerald-50 text-emerald-600"
                  : "border-rose-200 bg-rose-50 text-rose-600"
              }`}
            >
              {testResult.success ? "✓ Connection successful" : `✗ ${testResult.message || "Connection failed"}`}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Connection Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={formData.connectionName}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, connectionName: e.target.value }))
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
              placeholder="Production DB"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Host <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={formData.host}
              onChange={(e) => setFormData((prev) => ({ ...prev, host: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
              placeholder="localhost"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Port <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              value={formData.port}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, port: parseInt(e.target.value) || 5432 }))
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
              placeholder="5432"
              min="1"
              max="65535"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Database <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={formData.database}
              onChange={(e) => setFormData((prev) => ({ ...prev, database: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
              placeholder="mydb"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Username <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData((prev) => ({ ...prev, username: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
              placeholder="postgres"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Password {!formData.connectionId && <span className="text-rose-500">*</span>}
            </label>
            <input
              type="password"
              value={formData.password || ""}
              onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
              placeholder={formData.connectionId ? "Leave empty to keep existing" : ""}
            />
            {formData.connectionId && (
              <p className="mt-1 text-xs text-slate-500">Leave empty to keep existing password</p>
            )}
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="ssl"
              checked={formData.ssl}
              onChange={(e) => setFormData((prev) => ({ ...prev, ssl: e.target.checked }))}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400"
            />
            <label htmlFor="ssl" className="ml-2 text-sm text-slate-700">
              Enable SSL
            </label>
          </div>
        </div>

        <div className="border-t border-slate-200 px-6 py-4 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            disabled={isTesting || isSaving}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleTest}
            disabled={isTesting || isSaving || !formData.host || !formData.database || !formData.username}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isTesting ? "Testing..." : "Test Connection"}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isTesting || isSaving || !formData.host || !formData.database || !formData.username}
            className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof window !== "undefined" ? createPortal(modal, document.body) : null;
}

