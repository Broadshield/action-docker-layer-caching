import * as exec from '@actions/exec';
import { ExecOptions } from '@actions/exec/lib/interfaces'
import { CommandOutput } from './command-output';

interface EnvironmentVariable {
  [key: string]: string;
}

export class CommandHelper {
  private command: string | undefined;

  private args: string[] | undefined;
  private options: ExecOptions | undefined;

  private workingDirectory: string;

  constructor(
    workingDirectory: string,
    command: string | undefined,
    arguments_: string[] | undefined,
     options?: ExecOptions
  ) {
    this.workingDirectory = workingDirectory;
    this.options = options;
    if (command) {

      if (arguments_ === undefined) {
        // const cmdArr = command.match(/[^\s"]+|"([^"]*)"/gi)
        const parseWords = (words = ''): string[] =>
          (words.match(/[^\s"]+|"([^"]*)"/gi) || []).map(word =>
            word.replace(/^"(.+(?="$))"$/, '$1')
          );
        const cmdArray = parseWords(command);

        if (cmdArray) {
          this.command = cmdArray[0] || '';
          this.args = cmdArray.slice(1) || [];
        }
      } else {
        this.command = command;
        this.args = arguments_;
      }
    } else {
      this.command = undefined;
      this.args = undefined;
    }

  }

  async exec(allowAllExitCodes = false): Promise<CommandOutput> {
    const result = new CommandOutput();
    if (this.command) {
      const environment: EnvironmentVariable = {};
      for (const key of Object.keys(process.env)) {
        environment[key] = process.env[key] || '';
      }

      const stdout: string[] = [];
      const stderr: string[] = [];

      const options: ExecOptions = {
        cwd: this.workingDirectory,
        env: environment,
        ignoreReturnCode: allowAllExitCodes,
        listeners: {
          stdout: (data: Buffer) => {
            stdout.push(data.toString());
          },
          stderr: (data: Buffer) => {
            stderr.push(data.toString());
          }
        },
        ...this.options
      };

      result.exitCode = await exec.exec(
        `"${this.command}"`,
        this.args,
        options
      );
      result.stdout = stdout.join('').trim();
      result.stderr = stderr.join('').trim();
    }
    return result;
  }
}

