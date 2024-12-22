'use client'
import Image from 'next/image';

export default function DocsPage() {
  return (
    <div className="container mx-auto px-4 py-8 flex justify-center">
      <Image
        src="/opentask-roadmap.png"
        alt="Roadmap"
        width={800}
        height={600}
        className="rounded-lg shadow-lg"
      />
    </div>
  );
}