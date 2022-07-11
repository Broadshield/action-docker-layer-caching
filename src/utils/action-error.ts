import * as core from '@actions/core';
import ansiColors from 'ansi-colors';

const kIsNodeError = Symbol('kIsNodeError');
export type LogLevel = 'debug' | 'info' | 'warning' | 'notice' | 'error';
export type LogLevels = { [key in LogLevel]: boolean };
export type additionalErrorArgumentType =
  | NodeJS.ErrnoException
  | Error
  | string
  | object
  | undefined
  | null
  | number
  | unknown;
interface JsonHighlightInterface {
  [index: string]: ansiColors.StyleFunction;
}

/**
 * A typeguarded version of `instanceof Error` for NodeJS.
 * @author Joseph JDBar Barron
 * @link https://dev.to/jdbar
 */
export function instanceOfNodeError<
  T extends new (...arguments_: any) => Error
>(
  value: Error,
  errorType: T
): value is InstanceType<T> & NodeJS.ErrnoException {
  return value instanceof errorType;
}
export function isError(error: any): error is NodeJS.ErrnoException {
  return error instanceof Error;
}
export default class ActionError extends Error {
  static errors: string[] = [];

  static style = ansiColors.create();

  static from(error: Error | unknown): ActionError {
    if (error instanceof ActionError) {
      return error;
    }
    return new ActionError(`Unhandled Error:`, error);
  }

  constructor(message: string, ...arguments_: additionalErrorArgumentType[]) {
    super(message);
    // 👇️ because we are extending a built-in class
    Object.setPrototypeOf(this, ActionError.prototype);
    ActionError.errors.push(message);
    this.parseExtraArgs(...arguments_);
  }

  parseExtraArgs(...arguments_: additionalErrorArgumentType[]): void {
    if (arguments_.length === 0) {
      return;
    }
    if (!this.stack) {
      this.stack = '';
    }
    for (const argument of arguments_) {
      if (argument instanceof Error) {
        let errorString = '';

        if (kIsNodeError in argument) {
          const error = argument as NodeJS.ErrnoException;
          errorString = `${error.name} [${error.code}]: ${error.message}`;
        } else {
          const error = argument;
          errorString = error.toString();
        }
        this.stack += ActionError.prettyString({
          message: errorString,
          stack: argument.stack ? argument.stack.split('\n') : null
        });
      } else if (typeof argument === 'string') {
        this.stack += `\n${argument}`;
      } else if (typeof argument === 'object') {
        this.stack += `\n${JSON.stringify(argument, null, 2)}`;
      } else if (typeof argument === 'number') {
        this.stack += `\n${argument}`;
      } else if (typeof argument === 'undefined') {
        this.stack += `\nundefined`;
      }
    }
  }

  getError(): string {
    return `${this.getErrorMessage()}\n${this.getErrorStack()}`;
  }

  logError(): void {
    this.logErrorMessage();
    this.logErrorStack();
  }

  getErrorMessage(): string {
    return `${this.message}`;
  }

  static getErrorMessagesArray(): string[] {
    return ActionError.errors;
  }

  getErrorStack(): string {
    return this.stack || '';
  }

  logErrorStack(): void {
    if (this.stack) {
      core.error(this.stack);
    }
  }

  logErrorMessage(): void {
    core.error(`⛔️ ${ActionError.style.red(this.getErrorMessage())}`);
  }

  static logErrorMessagesArray(): void {
    for (const error of ActionError.errors) {
      core.error(`⛔️ ${ActionError.style.red(error)}`);
    }
  }

  toString(): string {
    return this.getError();
  }

  static prettyString(providedJson: string | object | number): string {
    const jsonHighlight = {
      number: ActionError.style.yellow,
      string: ActionError.style.green,
      boolean: ActionError.style.cyanBright,
      null: ActionError.style.bold.cyanBright,
      key: ActionError.style.bold.cyan
    } as JsonHighlightInterface;
    let json: string =
      typeof providedJson === 'object'
        ? JSON.stringify(providedJson, undefined, 2)
        : `${providedJson}`;
    json = json
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return json.replace(
      // eslint-disable-next-line security/detect-unsafe-regex
      /("(\\u[\dA-Za-z]{4}|\\[^u]|[^"\\])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[Ee][+-]?\d+)?)/g,
      match => {
        let typeKey = 'number';
        if (match.startsWith('"')) {
          typeKey = match.endsWith(':') ? 'key' : 'string';
        } else if (/true|false/.test(match)) {
          typeKey = 'boolean';
        } else if (match.includes('null')) {
          typeKey = 'null';
        }
        return jsonHighlight[typeKey](match);
      }
    );
  }
}
