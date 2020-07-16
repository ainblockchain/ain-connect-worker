import * as util from 'util';

const exec = util.promisify(require('child_process').exec);

type commandResult = {
  stdout: string,
  stderr: string,
  status_code: number,
}

export default class k8s {
  static async runCommand(kubectl_cmd: string): Promise<commandResult> {
    const command = `cat << EOF | kubectl ${kubectl_cmd} 
EOF`;
    try {
      const result = await exec(command);

      return {
        ...result,
        status_code: 0,
      };
    } catch (error) {
      return {
        stdout: error.stdout,
        stderr: error.stderr,
        status_code: error.code,
      };
    }
  }
}
