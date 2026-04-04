import asyncio

import serial

from backend.config import SERIAL_DEVICE, SERIAL_BAUD, LED_CHANNELS, LED_COUNT


def _send_led_colors(channel: int, r: int, g: int, b: int):
    header = bytes([0xFF, 0xEE, 0x01, channel,
                    (LED_COUNT >> 8) & 0xFF, LED_COUNT & 0xFF, 0x00])
    grb_data = bytes([g, r, b] * LED_COUNT)
    try:
        with serial.Serial(SERIAL_DEVICE, SERIAL_BAUD, timeout=1) as ser:
            ser.write(header + grb_data)
            ser.flush()
    except Exception as e:
        import logging
        logging.warning(f"LED serial error: {e}")


async def set_color(r: int, g: int, b: int):
    for ch in LED_CHANNELS:
        await asyncio.to_thread(_send_led_colors, ch, r, g, b)
        await asyncio.sleep(0.05)


async def turn_off():
    await set_color(0, 0, 0)
