export type LogLevel = 'info' | 'success' | 'warn' | 'error' | 'system';

export interface LogEntry {
  id:        string;
  ts:        string;
  level:     LogLevel;
  message:   string;
  highlight: string | null;
}
