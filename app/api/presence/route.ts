import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    let datebegin = url.searchParams.get('datebegin');
    if (!datebegin) {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      datebegin = `${dd}.${mm}.${yyyy}`;
    }

    const upstream = `http://localhost:9000/tillypad-api/arka/custom-execute/get-userpresence?datebegin=${datebegin}`;

    const res = await fetch(upstream, {
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return NextResponse.json(
        { error: `Upstream HTTP ${res.status}`, details: text.slice(0, 300) },
        { status: 502 },
      );
    }

    const data = await res.json();
    const main = Array.isArray((data as any).Main) ? (data as any).Main : [];
    return NextResponse.json(main);
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Proxy error', message: String(err?.message ?? err) },
      { status: 500 },
    );
  }
}
