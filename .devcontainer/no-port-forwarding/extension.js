// @ts-check

const vscode = require('vscode');

/**
 * Registers a no-op tunnel provider that replaces VS Code's built-in port
 * forwarding. This prevents the recursive process-spawning bug that occurs
 * with host networking in devcontainers.
 *
 * @see https://github.com/microsoft/vscode-remote-release/issues/9993
 *
 * @param {vscode.ExtensionContext} context
 */
async function activate(context) {
  const disposable = await vscode.workspace.registerTunnelProvider(
    {
      provideTunnel(_tunnelOptions, _tunnelCreationOptions, _token) {
        // Return undefined to signal that no tunnel should be created.
        // This effectively disables port forwarding.
        return undefined;
      }
    },
    {
      tunnelFeatures: {
        elevation: false,
        privacyOptions: [{ id: 'private', label: 'Private', themeIcon: 'lock' }],
        protocol: false
      }
    }
  );
  context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = { activate, deactivate };
