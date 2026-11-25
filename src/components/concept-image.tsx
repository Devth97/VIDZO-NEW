export type ConceptId = 'ritual' | 'sound' | 'form';
export const concepts: { id: ConceptId; category: string; title: string; direction: string; alt: string }[] = [
  { id: 'ritual', category: 'Beauty', title: 'A daily ritual, reframed.', direction: 'Warm light. A tactile product reveal. Space for your brand.', alt: 'Illustrative olive serum bottle on sunlit travertine and sculptural paper' },
  { id: 'sound', category: 'Electronics', title: 'Let the design do the talking.', direction: 'Sculptural shapes, close-up details and a quiet, confident reveal.', alt: 'Illustrative cream headphones on curved terracotta paper' },
  { id: 'form', category: 'Jewelry', title: 'Small object. Strong presence.', direction: 'A study in texture, light and the details worth slowing down for.', alt: 'Illustrative gold cuff bracelet on dark stone and ivory satin' },
];
export function ConceptImage({ id, priority = false, className = '' }: { id: ConceptId; priority?: boolean; className?: string }) {
  const concept = concepts.find(c => c.id === id)!;
  return <img className={'concept-image ' + className} src={`/assets/concepts/${id}-900.webp`} srcSet={`/assets/concepts/${id}-480.webp 480w, /assets/concepts/${id}-900.webp 900w`} sizes="(max-width: 767px) 90vw, (max-width: 1100px) 45vw, 540px" width={900} height={1125} alt={concept.alt} loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : undefined} decoding="async"/>;
}
