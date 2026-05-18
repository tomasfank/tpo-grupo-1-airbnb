import React from 'react';
export const Money = ({ value }) => <>{new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(Number(value || 0))}</>;
export const Badge = ({ children, tone='neutral' }) => <span className={`badge ${tone}`}>{children}</span>;
export const EmptyState = ({ title, text }) => <div className="empty"><h3>{title}</h3><p>{text}</p></div>;
export function Field({ label, children }) { return <label className="field"><span>{label}</span>{children}</label>; }
