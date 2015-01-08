import snap7
import Queue
import threading
import time
import datetime
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
        subprocess.call(["sudo","-u","root","-p","root","ifconfig",ipAddress,"netmask","255.255.255.0","up"])

def ResetEth():
        subprocess.call(["sudo","-u","root","-p","root","/etc/init.d/networking","restart"])

Id = int(GetId())

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
skdState = 0

bytesToCheck = {0,1,2,3,4,5,6,7,8,9};
while len(bytesToCheck) > 0:
        bytesToCheck.pop()
for it in keyArr:
        bytesToCheck.add(int(it))

firstArrayFromPLC = bytearray(size)
secondArrayForCheck = bytearray(size)

q = Queue.Queue()

def checkBuffer(firstArrayFromPLC, secondArrayForCheck, bytesToCheck):
        for item in bytesToCheck:
                if(firstArrayFromPLC[int(item)] != secondArrayForCheck[int(item)]):
                        return True
        return False

def sendBufferToServer(buf):
        try:
                tcpClient = socket.socket()
                tcpClient.connect((serverAddress, serverPort))
                tcpClient.send(buf)
                response = tcpClient.recv(16)
                tcpClient.close()
                if response == "0":
                        return True
                elif response == "service":
                        subprocess.Popen(["sudo","-u","root","-p","root","python",CurDir + "service.py"])
                        exit()
                        return True
                else:
                        thread = threading.Thread(target = SendToSkd, args=(response,))
                        thread.daemon = True
                        thread.start()
                        return True
                        
        except Exception as error:
                pass
                sys.exc_clear()
                print error
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

def SKDEventsReceiver(skdState):
        server = socket.socket()
        server.bind(("", 10000))
        server.listen(3)
        while True:
                try:
                        skdSock, addr = server.accept()
                        print "Client connect"
                        state = skdSock.recv(3)
                        skdSock.close()
                        print "State from skd: " + state
                        if state[0] == "0":
                                skdState = skdState and 6
                        else:
                                skdState = skdState or 1
                        if state[1] == "0":
                                skdState = skdState and 5
                        else:
                                skdState = skdState or 2
                        if state[2] == "0":
                                skdState = skdState and 3
                        else:
                                skdState = skdState or 4
                        print skdState
                except Exception as error:
                        pass
                        sys.exc_clear()
                        print error

def SendToSkd(s):
        try:
                skdClient = socket.socket()
                skdClient.connect(("127.0.0.1",10001))
                skdClient.send(s)
                skdClient.close()
        except Exception as error:
                pass
                sys.exc_clear()
                print error

def readFromPLC(q,firstArrayFromPLC,secondArrayForCheck,bytesToCheck):
        client = snap7.client.Client()
        currentMillis=0
        lastMillis=0
        readPLCErrors=0
        while True:
                try:
                        if not(client.get_connected()):
                                client.connect(plcAddress, 0,0)
                        firstArrayFromPLC = bytearray(struct.pack("h",Id))
                        firstArrayFromPLC += bytearray(int(skdState))
                        firstArrayFromPLC += client.db_read(db, 0, size)
                        readPLCErrors=0
                        currentMillis = int(round(time.time()*1000))
                        if ((checkBuffer(firstArrayFromPLC, secondArrayForCheck, bytesToCheck)) | (currentMillis-lastMillis>lightRead)):
                                lastMillis = currentMillis
                                secondArrayForCheck = firstArrayFromPLC
                                date = datetime.datetime.now()
                                firstArrayFromPLC += bytearray(struct.pack("h",date.year))
                                firstArrayFromPLC += bytearray(struct.pack("b",date.month))
                                firstArrayFromPLC += bytearray(struct.pack("b",date.day))
                                firstArrayFromPLC += bytearray(struct.pack("b",date.hour))
                                firstArrayFromPLC += bytearray(struct.pack("b",date.minute))
                                firstArrayFromPLC += bytearray(struct.pack("b",date.second))
                                firstArrayFromPLC += bytearray(struct.pack("i",date.microsecond))
                                q.put(firstArrayFromPLC)
                                time.sleep(hardRead)
                except Exception as error:
                        pass
                        sys.exc_clear()
                        print error
                        print 'Waiting 3 sec'
                        readPLCErrors=readPLCErrors+1
                        if readPLCErrors>20:
                                ResetEth()
                                SetIp(ipAddress)
                        time.sleep(3)
                time.sleep(0.01)

print 'Manage started'
print
print "Current Settings is"
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

tReadFromSKD = threading.Thread(target=SKDEventsReceiver, args = (skdState,))
tReadFromSKD.daemon = True
tReadFromSKD.start()

t1.join()
t2.join()
tReadFromSKD.join()