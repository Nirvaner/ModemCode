#!/usr/bin/env bash

# NAT
sudo -u root -p root iptables -t nat -A POSTROUTING -o ppp0 -j MASQUERADE

# Run Zander
sudo -u root -p root bash /devir/ModemCode/start.sh

exit 0