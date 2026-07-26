import React from 'react';

export default         function SettingsField({ label, id, value, onChange, placeholder }) {
            return (
                <div>
                    <label className="block text-sm text-zinc-550 dark:text-zinc-400 mb-1.5 font-bold">{label}</label>
                    <input
                        type="text"
                        id={id}
                        value={value}
                        onChange={e => onChange(e.target.value)}
                        placeholder={placeholder}
                        className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    />
                </div>
            );
        }

        // Maintenance Jobs tracker page
