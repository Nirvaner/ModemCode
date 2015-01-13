import subprocess
import os

CurDir = "/devir/ModemCode/Python/"

while True:
	subprocess.call(["sudo","-u","root","-p","root","python",CurDir + "serviceSub.py"])
	if os.path.exists(CurDir + "service.update"):
		print "Update serviceSub.py"
		subprocess.call(["sudo","-u","root","-p","root","mv",CurDir + "serviceSub.py",CurDir + "baks/serviceSub.py.bak"])
		subprocess.call(["sudo","-u","root","-p","root","mv",CurDir + "service.update",CurDir + "serviceSub.py"]);
	else:
		break