import time
import socket
import subprocess
import sys
import os
import datetime

CurDir = "/home/pi/Python/"

while True:
	subprocess.call(["sudo","-u","root","-p","root","python",CurDir + "serviceSub.py"])
	if os.path.exists(CurDir + "service.update"):
		subprocess.call(["sudo","-u","root","-p","root","mv",CurDir + "serviceSub.py",CurDir + "baks/serviceSub.py.bak"])
		subprocess.call(["sudo","-u","root","-p","root","mv",CurDir + "service.update",CurDir + "serviceSub.py"]);
	else:
		break

print "Service Ok"
