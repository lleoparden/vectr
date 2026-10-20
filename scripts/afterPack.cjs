/**
 * Ad-hoc signing hook for the macOS build.
 *
 * An Apple Silicon app with no code signature is reported by Gatekeeper as **damaged**, not merely
 * "unidentified developer", because every arm64 binary must carry at least an ad-hoc signature. The
 * project has no Apple Developer ID, so this signs the packaged bundle ad-hoc (`codesign -s -`) after
 * electron-builder packs it. The DMG is then built from the signed bundle.
 */

const { execFileSync } = require('node:child_process')
const path = require('node:path')

exports.default = async function afterPack(context) {
  if (process.platform !== 'darwin') return
  const appName = `${context.packager.appInfo.productFilename}.app`
  const appPath = path.join(context.appOutDir, appName)
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' })
  const verify = execFileSync('codesign', ['--verify', '--deep', '--strict', appPath], { stdio: 'pipe' })
  console.log('[afterPack] ad-hoc signed ' + appPath + (verify ? '' : ''))
}
