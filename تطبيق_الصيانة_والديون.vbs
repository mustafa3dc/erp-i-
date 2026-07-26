Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = WshShell.CurrentDirectory
WshShell.Run "python run_desktop.py", 0, False
