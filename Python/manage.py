import snap7
import Queue
import threading
import time
import socket
import subprocess
import sys
import os
import struct

CurDir = "/devir/ModemCode/Python/"

def ConnectTo3g():
        subprocess.call(["sudo","-u","root","-p","root","sakis3g","reconnect","-console"])

def GetStrFromFile(path):
        f = open(path,"r")
        res = f.read().strip('\0')
        f.close()
        return res.strip('\n')

def GetId():
        return GetStrFromFile(CurDir + "id")

def SetIp(ipAddress):
        subprocess.Popen(["sudo","-u","root","-p","root","ifconfig",s,"netmask","255.255.255.0","up"])

def ResetEth():
        subprocess.Popen(["sudo","-u","root","-p","root","/etc/init.d/networking","restart"])

Id = GetId()

if os.path.exists(CurDir + "data/Settings") != True:
        subprocess.Popen(["sudo","-u","root","-p","root","python",CurDir + "service.py"])
        exit()
setArr = GetStrFromFile(CurDir + "data/Settings").split('|')

serverPort = 10102

serverAddress = setArr[0]
ipAddress = setArr[1]
plcAddress = setArr[2]
db = int(setArr[3])
size = int(setArr[4])
lightRead = int(setArr[5]) * 1000
hardRead = float(setArr[6]) / 1000
keyArr = setArr[7].split(',')

bytesToCheck = {0,1,2,3,4,5,6,7,8,9};
while len(bytesToCheck) > 0:
        bytesToCheck.pop()
for it in keyArr:
        bytesToCheck.add(int(it))

firstArrayFromPLC = bytearray(size)
secondArrayForCheck = bytearray(size)

server = socket.socket()

q = Queue.Queue()

def checkBuffer(firstArrayFromPLC, secondArrayForCheck, bytesToCheck):
        for item in bytesToCheck:
                if(firstArrayFromPLC[int(item)] != secondArrayForCheck[int(item)]):
                        return True
        return False

def sendBufferToServer(buf):
        try:
                if not(server.get_connected()):
                        server.connect((serverAddress, serverPort))
                bufToSend = bytearray(struct.pack("h",int(Id,16)))
                bufToSend += buf
                server.send(bufToSend)
                response = server.recv(16)
                if response == "0":
                        return True
                elif response == "service":
                        subprocess.Popen(["sudo","-u","root","-p","root","python",CurDir + "service.py"])
                        exit()
        except Exception:
                pass
                sys.exc_clear()
                print "Conndect to 3g"
                ConnectTo3g()
        return False

def readFromQueue(q):
        while True:
                if q.qsize()>0:
                        obj = q.get()
                        if not(sendBufferToServer(obj)):
                                q.put(obj)
                        print "time sleep"
                        time.sleep(0.01)

def readFromPLC(q,firstArrayFromPLC,secondArrayForCheck,bytesToCheck):
        client = snap7.client.Client()
        currentMillis=0
        lastMillis=0
        readPLCErrors=0
        while True:
                try:
                        if not(client.get_connected()):
                                client.connect(plcAddress, 0,0)
                        firstArrayFromPLC = client.db_read(db, 0, size)
                        readPLCErrors=0
                        currentMillis = int(round(time.time()*1000))
                        if ((checkBuffer(firstArrayFromPLC, secondArrayForCheck, bytesToCheck)) | (currentMillis-lastMillis>lightRead)):
                                lastMillis = currentMillis
                                secondArrayForCheck = firstArrayFromPLC
                                q.put(firstArrayFromPLC)
                                time.sleep(hardRead)
                except Exception:
                        pass
                        sys.exc_clear()
                        print 'Waiting 3 sec'
                        readPLCErrors=readPLCErrors+1
                        if readPLCErrors>20:
                                ResetEth()
                                SetIp(ipAddress)
                        time.sleep(3)
                time.sleep(0.01)

print 'Manage started'

print "ServerAddress: " + serverAddress
print "ServerPort: " + str(serverPort)
print "PLC Address: " + plcAddress
print "DB: " + str(db)
print "DBSize: " + str(size)
print "LightReadInterval (sec): " + str(lightRead)
print "HardReadInterval (sec): " + str(hardRead)
print "BufferCheck: " + str(bytesToCheck)

print
print "Connect to 3g"
ConnectTo3g()

t1 = threading.Thread(target=readFromPLC, args = (q,firstArrayFromPLC,secondArrayForCheck,bytesToCheck))
t1.daemon = True
t1.start()

t2 = threading.Thread(target=readFromQueue, args = (q,))
t2.daemon = True
t2.start()

t1.join()
t2.join()