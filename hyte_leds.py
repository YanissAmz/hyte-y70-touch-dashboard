#!/usr/bin/env python3
"""Control HYTE Y70 Touch LEDs via serial protocol (reverse-engineered from OpenRGB)"""
import serial
import sys
import time

DEVICE = "/dev/ttyACM0"

def send_led_colors(ser, channel, num_leds, r, g, b):
    """Send LED color command to a channel
    Protocol: FF EE 01 <channel> <led_count_h> <led_count_l> 00 <GRB repeat>
    """
    buf = bytearray(7 + num_leds * 3)
    buf[0] = 0xFF
    buf[1] = 0xEE
    buf[2] = 0x01
    buf[3] = channel
    buf[4] = (num_leds >> 8) & 0xFF
    buf[5] = num_leds & 0xFF
    buf[6] = 0x00
    for i in range(num_leds):
        offset = 7 + i * 3
        buf[offset] = g
        buf[offset + 1] = r
        buf[offset + 2] = b
    ser.write(buf)
    ser.flush()

def get_channel_info(ser, channel):
    """Query channel for connected devices"""
    cmd = bytes([0xFF, 0xCC, 0x01, channel])
    ser.write(cmd)
    ser.flush()
    time.sleep(0.1)
    resp = ser.read(240)
    return resp

def main():
    if len(sys.argv) < 2:
        print("Usage:")
        print("  hyte_leds.py off        - Turn off all LEDs")
        print("  hyte_leds.py on         - Set LEDs to white")
        print("  hyte_leds.py color R G B - Set custom color (0-255)")
        print("  hyte_leds.py scan       - Scan for connected devices")
        sys.exit(1)

    action = sys.argv[1]

    try:
        ser = serial.Serial(DEVICE, 2000000, timeout=1)
    except Exception as e:
        print(f"Cannot open {DEVICE}: {e}")
        print("Try: sudo chmod 666 /dev/ttyACM0")
        sys.exit(1)

    if action == "scan":
        for ch in range(4):
            resp = get_channel_info(ser, ch)
            if resp:
                print(f"Channel {ch}: {resp.hex()}")
            else:
                print(f"Channel {ch}: no response")
        ser.close()
        return

    if action == "off":
        r, g, b = 0, 0, 0
    elif action == "on":
        r, g, b = 255, 255, 255
    elif action == "color" and len(sys.argv) == 5:
        r, g, b = int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4])
    else:
        print("Invalid arguments")
        sys.exit(1)

    # Try all channels with reasonable LED counts
    for ch in range(1, 4):
        send_led_colors(ser, ch, 100, r, g, b)
        time.sleep(0.05)

    print(f"LEDs set to RGB({r}, {g}, {b})")
    ser.close()

if __name__ == "__main__":
    main()
