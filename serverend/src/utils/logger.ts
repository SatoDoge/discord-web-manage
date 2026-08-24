type LogLevel = 'INFO' | 'NOTICE' | 'DEBUG' | 'WARN' | 'ERROR';

export class Logger {
	constructor(private readonly appName: string) {}

	info(...messages: unknown[]) {
		this.write('INFO', messages);
	}

	notice(...messages: unknown[]) {
		this.write('NOTICE', messages);
	}

	debug(...messages: unknown[]) {
		this.write('DEBUG', messages);
	}

	warn(...messages: unknown[]) {
		this.write('WARN', messages);
	}

	error(...messages: unknown[]) {
		this.write('ERROR', messages);
	}

	private write(level: LogLevel, messages: unknown[]) {
		const time = this.formatTime(new Date());
		const message = messages.map((value) => this.formatValue(value)).join(' ');
		console.log(`[${time}][${this.appName}][${level}] ${message}`);
	}

	private formatTime(date: Date) {
		const hours = String(date.getHours()).padStart(2, '0');
		const minutes = String(date.getMinutes()).padStart(2, '0');
		const seconds = String(date.getSeconds()).padStart(2, '0');
		return `${hours}:${minutes}:${seconds}`;
	}

	private formatValue(value: unknown) {
		if (typeof value === 'string') {
			return value;
		}

		if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
			return String(value);
		}

		if (value instanceof Error) {
			return value.stack ?? value.message;
		}

		if (value === null) {
			return 'null';
		}

		if (value === undefined) {
			return 'undefined';
		}

		try {
			return JSON.stringify(value);
		} catch {
			return String(value);
		}
	}
}

export default Logger;