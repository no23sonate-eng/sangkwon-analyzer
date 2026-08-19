#!/usr/bin/env python3
"""기사 인용 클립 렌더 — B1M식 스크롤→확대→형광펜 와이프→홀드 (줌아웃 없음).

frames 인자에 맞춰 각 페이즈를 배분: 홀드가 남는 시간을 흡수하고,
홀드 중에는 아주 느린 줌 드리프트(1300→1230)로 정지감을 없앤다.
"""
import os, json, subprocess, sys
from PIL import Image, ImageDraw, ImageFilter

def render(shot_png, rects_json, out_mp4, frames,
           t_hold0, t_scroll, t_zoom, t_wipe, fps=30):
    SHOT = Image.open(shot_png).convert('RGB')
    S = 1.5
    rects = [{k: v*S for k, v in r.items()} for r in json.load(open(rects_json))]
    M = 120
    base = Image.new('RGB', (SHOT.width + M*2, SHOT.height + M*2), '#EFEAE3')
    sh = Image.new('L', base.size, 0)
    ImageDraw.Draw(sh).rectangle([M-2, M-2, M+SHOT.width+8, M+SHOT.height+8], fill=70)
    base.paste(Image.new('RGB', base.size, '#d8d2c8'), (0, 0), sh.filter(ImageFilter.GaussianBlur(14)))
    base.paste(SHOT, (M, M))
    for r in rects: r['x'] += M; r['y'] += M
    grain = Image.effect_noise(base.size, 14).convert('L')
    base_g = Image.blend(base, Image.merge('RGB', (grain, grain, grain)), 0.035)

    VW, VH = 1920, 1080
    T0, T1 = t_hold0, t_hold0 + t_scroll          # 스크롤
    T2 = T1 + t_zoom                              # 줌인
    T3 = T2 + t_wipe                              # 와이프
    T_END = frames / fps                          # 홀드 끝
    def smooth(t): return max(0, min(1, t))**2*(3-2*max(0, min(1, t)))
    total_w = sum(r['w'] for r in rects)
    sent_x0 = min(r['x'] for r in rects); sent_x1 = max(r['x']+r['w'] for r in rects)
    sent_cx = (sent_x0+sent_x1)/2
    sent_cy = sum((r['y']+r['h']/2)*r['w'] for r in rects)/total_w
    def tip_at(wp):
        acc = wp*total_w
        for r in rects:
            if acc <= r['w']: return r['x']+acc, r['y']+r['h']/2
            acc -= r['w']
        return rects[-1]['x']+rects[-1]['w'], rects[-1]['y']+rects[-1]['h']/2

    y_head = M + 340
    cam_x, cam_y = base.width/2, y_head
    tmp = out_mp4 + '.frames'
    os.makedirs(tmp, exist_ok=True)
    for f in range(frames):
        t = f/fps
        vw = 2100 - 800*smooth((t-T1)/(T2-T1))
        if t > T3:  # 홀드 — 느린 줌 드리프트
            vw = 1300 - 70*smooth((t-T3)/max(0.001, T_END-T3))
        vh = vw*VH/VW
        if t < T0:
            tx, ty = base.width/2, y_head
        elif t < T1:
            p = smooth((t-T0)/(T1-T0))
            tx, ty = base.width/2, y_head + (sent_cy - y_head)*p
        else:
            wp = smooth((t-T2)/(T3-T2))
            tipx, tipy = tip_at(wp)
            # 마커 끝을 더 적극적으로 따라가고(0.55), 마커 앞쪽 320px이
            # 항상 프레임 안에 들어오도록 룩어헤드 클램프 — 줄 오른쪽 끝
            # 글자가 잘리지 않게 한다.
            tx = sent_cx*0.45 + tipx*0.55
            tx = max(tx, tipx + 320 - vw/2)
            ty = sent_cy*0.75 + tipy*0.25
        cam_x += (tx-cam_x)*0.085; cam_y += (ty-cam_y)*0.085
        x0 = max(0, min(base.width-vw, cam_x-vw/2)); y0 = max(0, min(base.height-vh, cam_y-vh/2))
        frame = base_g.crop((int(x0), int(y0), int(x0+vw), int(y0+vh)))
        wp = smooth((t-T2)/(T3-T2))
        if wp > 0:
            d = ImageDraw.Draw(frame, 'RGBA'); remain = wp*total_w; pad = 7
            for r in rects:
                w = min(remain, r['w'])
                if w <= 0: break
                d.rectangle([r['x']-pad-x0, r['y']-pad-y0, r['x']+w+pad-x0, r['y']+r['h']+pad-y0],
                            fill=(250, 255, 46, 110))
                remain -= r['w']
        frame.resize((VW, VH), Image.LANCZOS).save(f'{tmp}/f{f:04d}.jpg', quality=90)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(fps), '-i', f'{tmp}/f%04d.jpg',
                    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', out_mp4], check=True)
    print(out_mp4, frames, 'frames', os.path.getsize(out_mp4)//1024, 'KB', flush=True)

if __name__ == '__main__':
    OUT = '/home/user/sangkwon-analyzer/youtube_pipeline/projects/하남스피어/broll_candidates/article_cite'
    os.makedirs(OUT, exist_ok=True)
    # #1 — fnnews, XML out 669 (+2), 22.3s: 홀드1.4 / 스크롤5.1 / 줌1.2 / 와이프3.5 / 홀드~11.2
    render('fn_article.png', 'fn_rects.json', f'{OUT}/sec1_fnnews_cite.mp4', 671,
           t_hold0=1.4, t_scroll=5.1, t_zoom=1.2, t_wipe=3.5)
    # #5 — 뉴스프리존, XML out 213 (+2), 7.1s: 홀드0 / 스크롤2.5 / 줌1.0 / 와이프2.6 / 홀드~1.0
    render('nfz_article.png', 'nfz_rects.json', f'{OUT}/sec5_nfz_cite.mp4', 215,
           t_hold0=0.0, t_scroll=2.5, t_zoom=1.0, t_wipe=2.6)
