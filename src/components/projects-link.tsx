'use client';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { useWorkspace } from './workspace-provider';

/** Only people who already have drafts need a way back to them. */
export function ProjectsLink() {
  const { projects } = useWorkspace();
  if (!projects.length) return null;
  return <Link className="entry-projects" href="/projects">Back to your projects<ArrowUpRight size={14}/></Link>;
}
