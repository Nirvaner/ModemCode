import time
import socket
import subprocess
import sys
import os

CurDir = "/home/pi/Python/"

def Connect3g():
        subprocess.call(["sudo","-u","root","-p","root","sakis3g","reconnect","-console"])

def SystemReboot():
        subprocess.popen(["sudo","-u","root","-p","root","reboot"])

def GetStrFromFile(path):
        f = open(path,"r")
        res = f.read()
        f.close()
        return res.strip('\n')

def SetStrInFile(path,s):
        f = open(path,"w")
        f.write(s)
        f.close()

def GetId():
        return GetStrFromFile(CurDir + "id")

def GetServiceServer():
        return GetStrFromFile(CurDir + "data/ServiceServer")

def SetServiceServer(s):
        SetStrInFile(CurDir + "data/ServiceServer",s)

def GetServiceVersion():
        return GetStrFromFile(CurDir + "data/ServiceVersion")
def SetServiceVersion(s):
        SetStringInFile(CurDir + "data/ServiceVersion",s)

def GetManageVersion():
        return GetStrFromFile(CurDir + "data/ManageVersion")

def SetManageVersion(s):
        SetStrInFile(CurDir + "data/ManageVersion")
def GetSkdVersion():
        GetStrFromFile(CurDir + "data/SKDVersion")

Id = GetId()
serviceVersion = GetServiceVersion()
manageVersion = GetManageVersion()
skdVersion = GetSkdVersion()
serverAddress = GetServiceServer()
serverPort = 10101

print "Service started"
try:
        server = socket.socket()
        server.connect((serverAddress,serverPort))
        server.sendall("|".join([Id,serviceVersion,manageVersion,skdVersion,serverAddress]))

        print "Get settings"
        print "Get size code"
        size = server.recv(16).strip('\0')
        print size
        server.sendall(size)
        
        print "Get code"
        code = server.recv(int(size)).strip('\0')
        SetStrInFile(CurDir + "data/Settings.update",code)
        server.sendall("0")

        print "Rename update files to executeble files"
        subprocess.call(["sudo","-u","root","-p","root","mv","data/Settings.update","data/Settings"])
        print "Settings update successfull!"

        response = server.recv(16).strip('\0')
        print response
        server.sendall("0")

        while True:
                if response == "run":
                        server.sendall("0")
                        subprocess.Popen(["sudo","-u","root","-p","root","python",CurDir + "manage.py"])
                        exit()

                elif response == "ipconfig":
                        print "Get size code"
                        size = server.recv(16).strip('\0')
                        print size
                        server.sendall(size)

                        print "Get code"
                        code = server.recv(int(size)).strip('\0')
                        SetStrInFile(CurDir + "/etc/network/interfaces.update",code)
                        server.sendall("0")

                        print "Rename update files to executeble files"
                        subprocess.call(["sudo","-u","root","-p","root","mv","/etc/network/interfaces.update","/etc/network/interfaces"])
                        print "IPConfig update successfull!"

                elif response == "manage":
                        print "Get size code"
                        size = server.recv(16).strip('\0')
                        print size
                        server.sendall(size)

                        print "Get code"
                        code = server.recv(int(size)).strip('\0')
                        SetStrInFile(CurDir + "manage.update",code)
                        server.sendall("0")

                        print "Get version"
                        versionUpdate = server.recv(16).strip('\0')
                        SetStrInFile("data/ManageVersion.update",versionUpdate)
                        print versionUpdate
                        server.sendall(versionUpdate)
                        print "Write update files Ok"

                        print "Rename update files to executeble files"
                        subprocess.call(["sudo","-u","root","-p","root","mv","manage.update","manage.py"])
                        subprocess.call(["sudo","-u","root","-p","root","mv","ManageVersion.update","ManageVersion"])
                        print "Manage update successfull!"

                elif response == "service":
                        print "Get size code"
                        size = server.recv(16).strip('\0')
                        print size
                        server.sendall(size)

                        print "Get code"
                        code = server.recv(int(size)).strip('\0')
                        SetStrInFile(CurDir + "service.update",code)
                        server.sendall("0")

                        print "Get version"
                        versionUpdate = server.recv(16).strip('\0')
                        SetStrInFile("data/ServiceVersion.update",versionUpdate)
                        print versionUpdate
                        server.sendall(versionUpdate)
                        print "Service update successfull!"

                elif response == "serverIp":
                        ServiceServer = server.recv(16)
                        SetStrInFile(CurDir + "data/ServiceServer.update",ServiceServer)
                        subprocess.call(["sudo","-u","root","-p","root","mv",SKDDir + "data/ServiceServer.update",SKDDir + "data/ServiceServer"])
                        server.sendall(ServiceServer)
                        print "ServiceServer Address is changen, modem go in reboot"
                        SystemReboot()

                elif response == "skd":
                        SKDDir = "/home/pi/skd/"
                        while True:
                                print "Get filename"
                                fileName = server.recv(16).strip("\0")
                                print fileName
                                server.sendall(fileName)

                                print "Get size code"
                                size = server.recv(16).strip('\0')
                                print size
                                server.sendall(size)

                                print "Get code"
                                code = server.recv(int(size)).strip('\0')
                                SetStrInFile(SKDDir + fileName + ".update",code)
                                server.sendall("0")

                                print "Rename update files to executeble files"
                                subprocess.call(["sudo","-u","root","-p","root","mv",SKDDir + fileName + ".update",SKDDir + fileName])
                                print "SKD update successfull!"

                                version = server.recv(16).strip('\0');
                                if version == "0":
                                        SetStrInFile(CurDir + "data/SKDVersion",versionOld)
                                        break
                                versionOld = version

        except Exception:
                pass
                print "Connect to ServiceServer: failed"
                break
