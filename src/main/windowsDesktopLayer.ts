import type { BrowserWindow, Rectangle } from 'electron'
import { execFile } from 'child_process'

export interface DesktopLayerStatus {
  supported: boolean
  attached: boolean
  widgetHandle?: string
  parentHandle?: string
  parentClass?: string
  hostHandle?: string
  hostClass?: string
}

const WINDOWS_DESKTOP_BRIDGE = String.raw`
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

if (-not ('StudyDesk.DesktopLayer' -as [type])) {
  Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Runtime.InteropServices;

namespace StudyDesk {
  public static class DesktopLayer {
    public delegate bool EnumWindowsProc(IntPtr hwnd, IntPtr lParam);

    public const int GWL_STYLE = -16;
    public const int GWL_EXSTYLE = -20;
    public const long WS_CHILD = 0x40000000L;
    public const long WS_POPUP = 0x80000000L;
    public const long WS_EX_LAYERED = 0x00080000L;
    public const long WS_EX_NOREDIRECTIONBITMAP = 0x00200000L;
    public const uint LWA_ALPHA = 0x00000002;
    public const uint SMTO_NORMAL = 0x0000;
    public const uint SWP_NOACTIVATE = 0x0010;
    public const uint SWP_FRAMECHANGED = 0x0020;
    public const uint SWP_SHOWWINDOW = 0x0040;
    public const int SW_SHOWNOACTIVATE = 4;

    [StructLayout(LayoutKind.Sequential)]
    public struct POINT { public int X; public int Y; }

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern IntPtr FindWindow(string className, string windowName);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern IntPtr FindWindowEx(IntPtr parent, IntPtr childAfter, string className, string windowName);

    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr SetParent(IntPtr child, IntPtr newParent);

    [DllImport("user32.dll")]
    public static extern IntPtr GetParent(IntPtr hwnd);

    [DllImport("user32.dll")]
    public static extern bool IsWindow(IntPtr hwnd);

    [DllImport("user32.dll", EntryPoint = "GetWindowLongPtr")]
    public static extern IntPtr GetWindowLongPtr64(IntPtr hwnd, int index);

    [DllImport("user32.dll", EntryPoint = "GetWindowLong")]
    public static extern IntPtr GetWindowLongPtr32(IntPtr hwnd, int index);

    [DllImport("user32.dll", EntryPoint = "SetWindowLongPtr", SetLastError = true)]
    public static extern IntPtr SetWindowLongPtr64(IntPtr hwnd, int index, IntPtr value);

    [DllImport("user32.dll", EntryPoint = "SetWindowLong", SetLastError = true)]
    public static extern IntPtr SetWindowLongPtr32(IntPtr hwnd, int index, IntPtr value);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetWindowPos(IntPtr hwnd, IntPtr insertAfter, int x, int y, int width, int height, uint flags);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetLayeredWindowAttributes(IntPtr hwnd, uint colorKey, byte alpha, uint flags);

    [DllImport("user32.dll")]
    public static extern bool ScreenToClient(IntPtr hwnd, ref POINT point);

    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hwnd, out RECT rect);

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hwnd, int command);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern int GetClassName(IntPtr hwnd, StringBuilder className, int maxCount);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr SendMessageTimeout(
      IntPtr hwnd, uint message, IntPtr wParam, IntPtr lParam,
      uint flags, uint timeout, out IntPtr result);

    public static IntPtr GetWindowLongPtr(IntPtr hwnd, int index) {
      return IntPtr.Size == 8 ? GetWindowLongPtr64(hwnd, index) : GetWindowLongPtr32(hwnd, index);
    }

    public static void SetWindowLongPtr(IntPtr hwnd, int index, IntPtr value) {
      if (IntPtr.Size == 8) SetWindowLongPtr64(hwnd, index, value);
      else SetWindowLongPtr32(hwnd, index, value);
    }

    public static string GetClass(IntPtr hwnd) {
      if (hwnd == IntPtr.Zero) return String.Empty;
      var name = new StringBuilder(256);
      GetClassName(hwnd, name, name.Capacity);
      return name.ToString();
    }

    public static bool IsRaisedDesktop { get; private set; }
    public static IntPtr ShellView { get; private set; }
    public static IntPtr WorkerW { get; private set; }

    // Win11 raised desktop 使用 Progman，并将窗口插入图标层与壁纸 WorkerW 之间。
    public static IntPtr FindDesktopHost() {
      var progman = FindWindow("Progman", null);
      if (progman == IntPtr.Zero) return IntPtr.Zero;

      IntPtr messageResult;
      SendMessageTimeout(progman, 0x052C, new IntPtr(0xD), new IntPtr(0x1), SMTO_NORMAL, 1000, out messageResult);

      long exStyle = GetWindowLongPtr(progman, GWL_EXSTYLE).ToInt64();
      IsRaisedDesktop = (exStyle & WS_EX_NOREDIRECTIONBITMAP) != 0;

      ShellView = IntPtr.Zero;
      WorkerW = IntPtr.Zero;
      EnumWindows(delegate(IntPtr topLevel, IntPtr state) {
        var defView = FindWindowEx(topLevel, IntPtr.Zero, "SHELLDLL_DefView", null);
        if (defView == IntPtr.Zero) return true;
        ShellView = defView;
        WorkerW = FindWindowEx(IntPtr.Zero, topLevel, "WorkerW", null);
        return false;
      }, IntPtr.Zero);

      if (IsRaisedDesktop) {
        WorkerW = FindWindowEx(progman, IntPtr.Zero, "WorkerW", null);
        return progman;
      }

      return WorkerW != IntPtr.Zero ? WorkerW : progman;
    }
  }
}
'@
}

function Format-Handle([IntPtr]$Handle) {
  return ('0x{0:X}' -f $Handle.ToInt64())
}

function Get-DesktopLayerState([IntPtr]$Widget, [IntPtr]$DesktopHost) {
  $parent = [StudyDesk.DesktopLayer]::GetParent($Widget)
  [pscustomobject]@{
    supported = $true
    attached = ($DesktopHost -ne [IntPtr]::Zero -and $parent -eq $DesktopHost)
    widgetHandle = Format-Handle $Widget
    parentHandle = Format-Handle $parent
    parentClass = [StudyDesk.DesktopLayer]::GetClass($parent)
    hostHandle = Format-Handle $DesktopHost
    hostClass = [StudyDesk.DesktopLayer]::GetClass($DesktopHost)
  }
}

function Invoke-DesktopLayer([string]$Action, [long]$Handle, [int]$X, [int]$Y, [int]$Width, [int]$Height) {
  $widget = [IntPtr]$Handle
  if (-not [StudyDesk.DesktopLayer]::IsWindow($widget)) { throw 'Electron window handle is invalid.' }

  $desktopHost = [StudyDesk.DesktopLayer]::FindDesktopHost()
  if ($desktopHost -eq [IntPtr]::Zero) { throw 'Windows desktop host was not found.' }

  if ($Action -eq 'attach') {
    $style = [StudyDesk.DesktopLayer]::GetWindowLongPtr($widget, [StudyDesk.DesktopLayer]::GWL_STYLE).ToInt64()
    $style = ($style -band (-bnot [StudyDesk.DesktopLayer]::WS_POPUP)) -bor [StudyDesk.DesktopLayer]::WS_CHILD
    [StudyDesk.DesktopLayer]::SetWindowLongPtr($widget, [StudyDesk.DesktopLayer]::GWL_STYLE, [IntPtr]$style)

    if ([StudyDesk.DesktopLayer]::IsRaisedDesktop) {
      $exStyle = [StudyDesk.DesktopLayer]::GetWindowLongPtr($widget, [StudyDesk.DesktopLayer]::GWL_EXSTYLE).ToInt64()
      $exStyle = $exStyle -bor [StudyDesk.DesktopLayer]::WS_EX_LAYERED
      [StudyDesk.DesktopLayer]::SetWindowLongPtr($widget, [StudyDesk.DesktopLayer]::GWL_EXSTYLE, [IntPtr]$exStyle)
      [void][StudyDesk.DesktopLayer]::SetLayeredWindowAttributes($widget, 0, 255, [StudyDesk.DesktopLayer]::LWA_ALPHA)
    }
    [void][StudyDesk.DesktopLayer]::SetParent($widget, $desktopHost)

    $point = New-Object StudyDesk.DesktopLayer+POINT
    $point.X = $X
    $point.Y = $Y
    [void][StudyDesk.DesktopLayer]::ScreenToClient($desktopHost, [ref]$point)
    $flags = [StudyDesk.DesktopLayer]::SWP_NOACTIVATE -bor [StudyDesk.DesktopLayer]::SWP_FRAMECHANGED -bor [StudyDesk.DesktopLayer]::SWP_SHOWWINDOW
    $insertAfter = [IntPtr]::Zero
    if ([StudyDesk.DesktopLayer]::IsRaisedDesktop -and [StudyDesk.DesktopLayer]::ShellView -ne [IntPtr]::Zero) {
      $insertAfter = [StudyDesk.DesktopLayer]::ShellView
      $workerW = [StudyDesk.DesktopLayer]::WorkerW
      if ($workerW -ne [IntPtr]::Zero) {
        $zFlags = [StudyDesk.DesktopLayer]::SWP_NOACTIVATE -bor 0x0001 -bor 0x0002
        [void][StudyDesk.DesktopLayer]::SetWindowPos($workerW, [IntPtr]1, 0, 0, 0, 0, $zFlags)
      }
    }
    if (-not [StudyDesk.DesktopLayer]::SetWindowPos($widget, $insertAfter, $point.X, $point.Y, $Width, $Height, $flags)) {
      throw 'SetWindowPos failed while attaching the widget.'
    }
    [void][StudyDesk.DesktopLayer]::ShowWindow($widget, [StudyDesk.DesktopLayer]::SW_SHOWNOACTIVATE)
  }
  elseif ($Action -eq 'detach') {
    $rect = New-Object StudyDesk.DesktopLayer+RECT
    [void][StudyDesk.DesktopLayer]::GetWindowRect($widget, [ref]$rect)
    [void][StudyDesk.DesktopLayer]::SetParent($widget, [IntPtr]::Zero)
    $style = [StudyDesk.DesktopLayer]::GetWindowLongPtr($widget, [StudyDesk.DesktopLayer]::GWL_STYLE).ToInt64()
    $style = ($style -band (-bnot [StudyDesk.DesktopLayer]::WS_CHILD)) -bor [StudyDesk.DesktopLayer]::WS_POPUP
    [StudyDesk.DesktopLayer]::SetWindowLongPtr($widget, [StudyDesk.DesktopLayer]::GWL_STYLE, [IntPtr]$style)
    $flags = [StudyDesk.DesktopLayer]::SWP_NOACTIVATE -bor [StudyDesk.DesktopLayer]::SWP_FRAMECHANGED
    [void][StudyDesk.DesktopLayer]::SetWindowPos($widget, [IntPtr]::Zero, $rect.Left, $rect.Top, ($rect.Right - $rect.Left), ($rect.Bottom - $rect.Top), $flags)
  }

  Get-DesktopLayerState $widget $desktopHost | ConvertTo-Json -Compress
}
`

function powershellCommand(action: 'attach' | 'detach' | 'inspect', handle: bigint, bounds?: Rectangle): string {
  const rectangle = bounds ?? { x: 0, y: 0, width: 0, height: 0 }
  return `${WINDOWS_DESKTOP_BRIDGE}\nInvoke-DesktopLayer -Action '${action}' -Handle ${handle.toString()} -X ${Math.round(rectangle.x)} -Y ${Math.round(rectangle.y)} -Width ${Math.round(rectangle.width)} -Height ${Math.round(rectangle.height)}`
}

function runPowershell(command: string): Promise<string> {
  const encoded = Buffer.from(command, 'utf16le').toString('base64')
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
      { windowsHide: true, timeout: 12_000, maxBuffer: 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(String(stderr || stdout || error.message).trim()))
          return
        }
        resolve(stdout.trim())
      }
    )
  })
}

export function nativeWindowHandleToBigInt(buffer: Buffer): bigint {
  if (buffer.length >= 8) return buffer.readBigUInt64LE(0)
  if (buffer.length >= 4) return BigInt(buffer.readUInt32LE(0))
  throw new Error(`Invalid native window handle buffer length: ${buffer.length}`)
}

export function parseDesktopLayerStatus(output: string): DesktopLayerStatus {
  const jsonLine = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .at(-1)
  if (!jsonLine) throw new Error('Desktop layer bridge returned no status.')
  return JSON.parse(jsonLine) as DesktopLayerStatus
}

async function invokeDesktopLayer(
  win: BrowserWindow,
  action: 'attach' | 'detach' | 'inspect',
  bounds?: Rectangle
): Promise<DesktopLayerStatus> {
  if (process.platform !== 'win32') return { supported: false, attached: false }
  const handle = nativeWindowHandleToBigInt(win.getNativeWindowHandle())
  const output = await runPowershell(powershellCommand(action, handle, bounds))
  return parseDesktopLayerStatus(output)
}

export function attachWindowToDesktop(win: BrowserWindow, bounds: Rectangle): Promise<DesktopLayerStatus> {
  return invokeDesktopLayer(win, 'attach', bounds)
}

export function detachWindowFromDesktop(win: BrowserWindow): Promise<DesktopLayerStatus> {
  return invokeDesktopLayer(win, 'detach')
}

export function inspectDesktopAttachment(win: BrowserWindow): Promise<DesktopLayerStatus> {
  return invokeDesktopLayer(win, 'inspect')
}
