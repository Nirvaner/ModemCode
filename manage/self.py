import subprocess
import os

CurDir = "/devir/ModemCode/manage/"

while True:
	subprocess.call(["sudo","-u","root","-p","root","python",CurDir + "service.py"])
	if os.path.exists(CurDir + "service"):
		print "Update service.py"
		subprocess.call(["sudo","-u","root","-p","root","mv",CurDir + "service.py",CurDir + "baks/service.py.bak"])
		subprocess.call(["sudo","-u","root","-p","root","mv",CurDir + "service",CurDir + "service.py"]);
	else:
		break