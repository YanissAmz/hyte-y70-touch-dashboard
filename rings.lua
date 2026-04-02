require 'cairo'

function draw_ring(cr, cx, cy, radius, width, start_angle, end_angle, value, max_val, bg_color, fg_color)
    local angle_span = end_angle - start_angle
    local val_angle = start_angle + (value / max_val) * angle_span

    cairo_set_line_cap(cr, CAIRO_LINE_CAP_ROUND)
    cairo_set_line_width(cr, width)
    cairo_set_source_rgba(cr, bg_color[1], bg_color[2], bg_color[3], bg_color[4])
    cairo_arc(cr, cx, cy, radius, start_angle, end_angle)
    cairo_stroke(cr)

    cairo_set_line_width(cr, width)
    cairo_set_source_rgba(cr, fg_color[1], fg_color[2], fg_color[3], fg_color[4])
    cairo_arc(cr, cx, cy, radius, start_angle, val_angle)
    cairo_stroke(cr)
end

function draw_text(cr, x, y, text, size, color, bold)
    local weight = CAIRO_FONT_WEIGHT_NORMAL
    if bold then weight = CAIRO_FONT_WEIGHT_BOLD end
    cairo_select_font_face(cr, "DejaVu Sans", CAIRO_FONT_SLANT_NORMAL, weight)
    cairo_set_font_size(cr, size)
    cairo_set_source_rgba(cr, color[1], color[2], color[3], color[4])
    local extents = cairo_text_extents_t:create()
    cairo_text_extents(cr, text, extents)
    cairo_move_to(cr, x - extents.width / 2 - extents.x_bearing, y)
    cairo_show_text(cr, text)
    cairo_stroke(cr)
end

function draw_rounded_rect(cr, x, y, w, h, r, color)
    cairo_set_source_rgba(cr, color[1], color[2], color[3], color[4])
    cairo_move_to(cr, x + r, y)
    cairo_line_to(cr, x + w - r, y)
    cairo_arc(cr, x + w - r, y + r, r, -math.pi/2, 0)
    cairo_line_to(cr, x + w, y + h - r)
    cairo_arc(cr, x + w - r, y + h - r, r, 0, math.pi/2)
    cairo_line_to(cr, x + r, y + h)
    cairo_arc(cr, x + r, y + h - r, r, math.pi/2, math.pi)
    cairo_line_to(cr, x, y + r)
    cairo_arc(cr, x + r, y + r, r, math.pi, 3*math.pi/2)
    cairo_close_path(cr)
    cairo_fill(cr)
end

function draw_background(cr, w, h)
    local pat = cairo_pattern_create_linear(0, 0, 0, h)
    cairo_pattern_add_color_stop_rgba(pat, 0, 0.04, 0.05, 0.07, 1)
    cairo_pattern_add_color_stop_rgba(pat, 0.3, 0.06, 0.07, 0.10, 1)
    cairo_pattern_add_color_stop_rgba(pat, 0.7, 0.06, 0.07, 0.10, 1)
    cairo_pattern_add_color_stop_rgba(pat, 1, 0.04, 0.05, 0.07, 1)
    cairo_rectangle(cr, 0, 0, w, h)
    cairo_set_source(cr, pat)
    cairo_fill(cr)
    cairo_pattern_destroy(pat)
end

function draw_separator(cr, x1, x2, y, color)
    cairo_set_source_rgba(cr, color[1], color[2], color[3], color[4])
    cairo_set_line_width(cr, 2)
    cairo_move_to(cr, x1, y)
    cairo_line_to(cr, x2, y)
    cairo_stroke(cr)
end

function conky_parse_num(str)
    local val = tonumber(conky_parse(str)) or 0
    return val
end

function get_gpu_util()
    local f = io.popen("nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits 2>/dev/null")
    local val = tonumber(f:read("*a")) or 0
    f:close()
    return val
end

function get_gpu_temp()
    local f = io.popen("nvidia-smi --query-gpu=temperature.gpu --format=csv,noheader 2>/dev/null")
    local val = f:read("*a"):gsub("%s+", "")
    f:close()
    return val
end

function get_gpu_mem()
    local f = io.popen("nvidia-smi --query-gpu=memory.used,memory.total --format=csv,noheader,nounits 2>/dev/null")
    local line = f:read("*a")
    f:close()
    local used, total = line:match("(%d+),%s*(%d+)")
    return (used or "0"), (total or "0")
end

function get_gpu_power()
    local f = io.popen("nvidia-smi --query-gpu=power.draw --format=csv,noheader 2>/dev/null")
    local val = f:read("*a"):gsub("%s+", "")
    f:close()
    return val
end

function get_weather()
    local f = io.popen("curl -s 'wttr.in/Evry?format=%t' 2>/dev/null")
    local val = f:read("*a"):gsub("%s+", " "):gsub("^%s+", ""):gsub("%s+$", "")
    f:close()
    if val == "" then val = "--" end
    return val
end

-- Draw a section with ring gauge
-- y = top of the card
function draw_gauge_section(cr, cx, w, y, card_h, title, subtitle, value, detail, color, bg_color, dim_color, white_color, grey_color)
    draw_rounded_rect(cr, 60, y, w - 120, card_h, 30, bg_color)
    draw_text(cr, cx, y + 65, title, 56, color, true)
    draw_text(cr, cx, y + 105, subtitle, 30, grey_color, false)
    local ring_cy = y + card_h / 2 + 30
    draw_ring(cr, cx, ring_cy, 145, 26, -math.pi * 0.75, math.pi * 0.75, value, 100, dim_color, color)
    draw_text(cr, cx, ring_cy + 20, value .. "%", 96, white_color, true)
    draw_text(cr, cx, y + card_h - 40, detail, 32, grey_color, false)
end

function conky_draw_dashboard()
    if conky_window == nil then return end

    local cs = cairo_xlib_surface_create(
        conky_window.display,
        conky_window.drawable,
        conky_window.visual,
        conky_window.width,
        conky_window.height
    )
    local cr = cairo_create(cs)

    local w = conky_window.width
    local h = conky_window.height
    local cx = w / 2

    -- Colors
    local blue    = {0.345, 0.651, 1.0, 1.0}
    local green   = {0.247, 0.725, 0.314, 1.0}
    local orange  = {0.941, 0.533, 0.243, 1.0}
    local red     = {0.973, 0.318, 0.286, 1.0}
    local white   = {0.9, 0.93, 0.95, 1.0}
    local grey    = {0.545, 0.58, 0.62, 1.0}
    local dim     = {0.2, 0.22, 0.25, 0.6}
    local card_bg = {0.05, 0.06, 0.08, 0.4}
    local sep     = {0.345, 0.651, 1.0, 0.3}

    -- Light overlay on wallpaper for contrast
    cairo_set_source_rgba(cr, 0, 0, 0, 0.05)
    cairo_rectangle(cr, 0, 0, w, h)
    cairo_fill(cr)

    -- ===== HEADER =====
    local time_str = conky_parse("${time %H:%M}")
    local date_str = conky_parse("${time %A %d %B}")
    local weather = get_weather()

    draw_text(cr, cx, 230, time_str, 180, blue, true)
    draw_text(cr, cx, 330, date_str, 52, grey, false)
    draw_text(cr, cx, 420, weather, 46, white, false)

    draw_separator(cr, 80, w - 80, 490, sep)

    -- Layout: 5 sections between y=530 and y=3700
    -- Each card = 560px, gap between = 50px
    -- Total = 5*560 + 4*50 = 3000, start=530, end=3530 => footer at 3630

    local card_h = 560
    local gap = 50
    local start_y = 530

    -- ===== CPU =====
    local cpu_val = conky_parse_num("${cpu}")
    local freq = conky_parse("${freq_g}")
    draw_gauge_section(cr, cx, w, start_y, card_h, "CPU", "Ryzen 9 7950X", cpu_val, freq .. " GHz", blue, card_bg, dim, white, grey)

    -- ===== MEMORY =====
    local mem_val = conky_parse_num("${memperc}")
    local mem_used = conky_parse("${mem}")
    local mem_total = conky_parse("${memmax}")
    draw_gauge_section(cr, cx, w, start_y + card_h + gap, card_h, "MEMORY", "DDR5 32GB", mem_val, mem_used .. " / " .. mem_total, green, card_bg, dim, white, grey)

    -- ===== GPU =====
    local gpu_val = get_gpu_util()
    local gpu_y = start_y + 2 * (card_h + gap)
    local gpu_card_h = 620
    draw_rounded_rect(cr, 60, gpu_y, w - 120, gpu_card_h, 30, card_bg)
    draw_text(cr, cx, gpu_y + 65, "GPU", 56, orange, true)
    draw_text(cr, cx, gpu_y + 105, "RTX 3090 24GB", 30, grey, false)
    local gpu_ring_cy = gpu_y + gpu_card_h / 2 + 10
    draw_ring(cr, cx, gpu_ring_cy, 145, 26, -math.pi * 0.75, math.pi * 0.75, gpu_val, 100, dim, orange)
    draw_text(cr, cx, gpu_ring_cy + 20, gpu_val .. "%", 96, white, true)
    local gpu_used, gpu_total = get_gpu_mem()
    draw_text(cr, cx, gpu_y + gpu_card_h - 90, gpu_used .. "MB / " .. gpu_total .. "MB", 32, grey, false)
    local gpu_temp = get_gpu_temp()
    local gpu_power = get_gpu_power()
    draw_text(cr, cx, gpu_y + gpu_card_h - 45, gpu_temp .. "C  |  " .. gpu_power, 28, grey, false)

    -- ===== STORAGE =====
    local disk_val = conky_parse_num("${fs_used_perc /}")
    local disk_used = conky_parse("${fs_used /}")
    local disk_total = conky_parse("${fs_size /}")
    local storage_y = gpu_y + gpu_card_h + gap
    draw_gauge_section(cr, cx, w, storage_y, card_h, "STORAGE", "SN850X 1TB", disk_val, disk_used .. " / " .. disk_total, blue, card_bg, dim, white, grey)

    -- ===== NETWORK =====
    local net_y = storage_y + card_h + gap
    local net_h = 500
    draw_rounded_rect(cr, 60, net_y, w - 120, net_h, 30, card_bg)
    draw_text(cr, cx, net_y + 65, "NETWORK", 56, red, true)
    draw_text(cr, cx, net_y + 105, "WiFi 5GHz", 30, grey, false)
    local dl = conky_parse("${downspeed wlp13s0}")
    local ul = conky_parse("${upspeed wlp13s0}")
    draw_text(cr, cx, net_y + 210, dl, 68, green, true)
    draw_text(cr, cx, net_y + 255, "download", 26, grey, false)
    draw_text(cr, cx, net_y + 360, ul, 68, red, true)
    draw_text(cr, cx, net_y + 405, "upload", 26, grey, false)

    -- ===== FOOTER =====
    local footer_y = net_y + net_h + 40
    draw_separator(cr, 80, w - 80, footer_y, sep)
    local uptime = conky_parse("${uptime_short}")
    draw_text(cr, cx, footer_y + 55, "yaniss-PC  |  uptime " .. uptime, 32, grey, false)

    cairo_destroy(cr)
    cairo_surface_destroy(cs)
end
