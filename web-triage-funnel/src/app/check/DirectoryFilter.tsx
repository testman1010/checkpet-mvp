'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export interface Symptom {
    slug: string;
    name: string;
}

export interface CategoryData {
    name: string;
    items: Symptom[];
}

export interface SpeciesData {
    name: 'Dogs' | 'Cats';
    categories: CategoryData[];
}

export interface DirectoryFilterProps {
    data: SpeciesData[];
}

export default function DirectoryFilter({ data }: DirectoryFilterProps) {
    const [activeSpecies, setActiveSpecies] = useState<'Dogs' | 'Cats'>('Dogs');
    const [searchQuery, setSearchQuery] = useState('');

    const query = searchQuery.toLowerCase();

    return (
        <div className="min-h-screen bg-white text-black font-sans flex flex-col">

            {/* --- Global Header --- */}
            <header className="bg-white border-b border-slate-100 py-4 px-4 sticky top-0 z-40">
                <div className="max-w-4xl mx-auto flex items-center justify-center">
                    {/* Simple Logo Link */}
                    <a href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                        <div className="w-8 h-8 rounded-lg overflow-hidden shadow-sm border border-slate-100">
                            <img src="/checkpet-logo.png" alt="CheckPet Logo" className="w-full h-full object-cover" />
                        </div>
                        <span className="text-lg font-bold text-slate-900 tracking-tight">CheckPet</span>
                    </a>
                </div>
            </header>

            {/* --- Hero Section & Trust Proxy --- */}
            <section className="bg-blue-50 py-16 px-4 sm:px-6 lg:px-8 text-center border-b border-blue-100">
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-gray-900 mb-6">
                        Pet Health Directory
                    </h1>
                    <p className="text-lg text-blue-800 font-medium max-w-2xl mx-auto mb-8 leading-relaxed">
                        Search our comprehensive database to quickly identify potential health, dietary, or behavioral issues affecting your pet. This directory is structured logically to help you find immediate, actionable answers for your dog or cat.
                    </p>

                    <div className="bg-white p-5 border border-blue-200 rounded-md mx-auto max-w-2xl text-center shadow-sm">
                        <p className="text-sm font-semibold text-blue-900 leading-relaxed uppercase tracking-wide">
                            Disclaimer
                        </p>
                        <p className="text-sm text-slate-600 mt-1">
                            This database is for informational purposes to help you understand potential conditions. Always consult a veterinarian for a final diagnosis.
                        </p>
                    </div>
                </div>
            </section>

            <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto w-full flex-grow">
                {/* Client-Side Controls */}
                <div className="sticky top-[73px] bg-white/95 backdrop-blur-sm z-30 py-4 border-b border-gray-100 mb-12 -mx-4 px-4 sm:mx-0 sm:px-0">

                    {/* Species Toggle */}
                    <div className="flex justify-center mb-8">
                        <div className="inline-flex rounded-lg border border-gray-300 p-1 bg-gray-50 shadow-sm">
                            <button
                                aria-pressed={activeSpecies === 'Dogs'}
                                onClick={() => setActiveSpecies('Dogs')}
                                className={`px-10 py-3 rounded-md text-sm font-bold transition-all ${activeSpecies === 'Dogs'
                                    ? 'bg-black text-white shadow'
                                    : 'text-gray-500 hover:text-black hover:bg-gray-100'
                                    }`}
                            >
                                Dogs
                            </button>
                            <button
                                aria-pressed={activeSpecies === 'Cats'}
                                onClick={() => setActiveSpecies('Cats')}
                                className={`px-10 py-3 rounded-md text-sm font-bold transition-all ${activeSpecies === 'Cats'
                                    ? 'bg-black text-white shadow'
                                    : 'text-gray-500 hover:text-black hover:bg-gray-100'
                                    }`}
                            >
                                Cats
                            </button>
                        </div>
                    </div>

                    {/* Search Filter */}
                    <div className="relative max-w-2xl mx-auto">
                        <input
                            type="text"
                            className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all text-lg text-gray-900 placeholder-gray-400 font-medium"
                            placeholder={"Filter specific symptoms, toxins, or behaviors..."}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            aria-label="Filter directory"
                        />
                        <svg className="absolute left-4 top-4 h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                </div>

                {/* Semantic Silos (Visually Compressed) */}
                <div className="w-full">
                    {data.map((speciesGroup) => (
                        <div
                            key={speciesGroup.name}
                            className={activeSpecies === speciesGroup.name ? "space-y-6 max-w-3xl mx-auto block" : "hidden"}
                            aria-hidden={activeSpecies !== speciesGroup.name}
                        >
                            {speciesGroup.categories.map((category) => {
                                const hasMatches = query === '' || category.items.some((item) => item.name.toLowerCase().includes(query));
                                const isSearching = query.length > 0;

                                return (
                                    <details
                                        key={category.name}
                                        className={`group border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm ${hasMatches ? 'block' : 'hidden'}`}
                                        open={isSearching ? true : undefined}
                                    >
                                        <summary className="flex items-center justify-between cursor-pointer px-6 py-5 hover:bg-gray-50 transition-colors select-none font-bold text-xl text-gray-900">
                                            {category.name}
                                            <span className="text-gray-400 group-open:rotate-180 transition-transform duration-200">
                                                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </span>
                                        </summary>
                                        <div className="px-6 py-5 border-t border-gray-100 bg-gray-50/50">
                                            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                                                {category.items.map((item) => {
                                                    const matches = query === '' || item.name.toLowerCase().includes(query);
                                                    return (
                                                        <li
                                                            key={item.slug}
                                                            className={`leading-relaxed ${matches ? 'block' : 'hidden'}`}
                                                        >
                                                            <Link
                                                                href={`/check/${item.slug}`}
                                                                className="inline-block text-gray-700 font-medium hover:text-black hover:underline decoration-1 underline-offset-4 transition-colors max-w-[75ch]"
                                                            >
                                                                {item.name}
                                                            </Link>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        </div>
                                    </details>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
