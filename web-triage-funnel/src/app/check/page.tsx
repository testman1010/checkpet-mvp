import fs from 'fs';
import path from 'path';
import Link from 'next/link';

export const dynamic = 'force-static';

interface Symptom {
    slug: string;
    name: string;
}

interface GroupedSymptoms {
    [letter: string]: Symptom[];
}

interface AnimalSymptoms {
    Dog: GroupedSymptoms;
    Cat: GroupedSymptoms;
}

async function getSymptoms(): Promise<AnimalSymptoms> {
    const symptomsDir = path.join(process.cwd(), 'src/data/pages');
    const filenames = fs.readdirSync(symptomsDir);

    const animalSymptoms: AnimalSymptoms = {
        Dog: {},
        Cat: {},
    };

    filenames.forEach((filename) => {
        if (!filename.endsWith('.json')) return;

        const slug = filename.replace('.json', '');
        const parts = slug.split('-');

        // Determine animal type (assuming slug starts with 'dog-' or 'cat-')
        let animal: 'Dog' | 'Cat' | null = null;
        if (parts[0] === 'dog') animal = 'Dog';
        else if (parts[0] === 'cat') animal = 'Cat';

        if (!animal) return;

        // Remove animal prefix for display name
        const symptomName = parts.slice(1).join(' ');
        // Capitalize first letter of symptom name
        const displayName = symptomName.charAt(0).toUpperCase() + symptomName.slice(1);

        const letter = displayName.charAt(0).toUpperCase();

        if (!animalSymptoms[animal][letter]) {
            animalSymptoms[animal][letter] = [];
        }

        animalSymptoms[animal][letter].push({
            slug: slug,
            name: displayName,
        });
    });

    // Sort groups and symptoms
    for (const animal of ['Dog', 'Cat'] as const) {
        const sortedKeys = Object.keys(animalSymptoms[animal]).sort();
        const sortedGroup: GroupedSymptoms = {};
        sortedKeys.forEach(key => {
            sortedGroup[key] = animalSymptoms[animal][key].sort((a, b) => a.name.localeCompare(b.name));
        });
        animalSymptoms[animal] = sortedGroup;
    }

    return animalSymptoms;
}

export default async function SymptomDictionary() {
    const symptoms = await getSymptoms();

    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-3xl font-extrabold text-gray-900 text-center mb-12">
                    Pet Symptom Dictionary
                </h1>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Dogs Column */}
                    <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                        <div className="px-4 py-5 sm:px-6 bg-blue-600">
                            <h2 className="text-xl leading-6 font-medium text-white">Dogs</h2>
                            <p className="mt-1 max-w-2xl text-sm text-blue-100">Common symptoms in dogs</p>
                        </div>
                        <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
                            {Object.entries(symptoms.Dog).length === 0 ? (
                                <p className="text-gray-500 italic">No dog symptoms found.</p>
                            ) : (
                                Object.entries(symptoms.Dog).map(([letter, list]) => (
                                    <div key={`dog-${letter}`} className="mb-6">
                                        <h3 className="text-lg font-bold text-gray-800 border-b border-gray-200 mb-2">{letter}</h3>
                                        <ul className="space-y-1">
                                            {list.map((symptom) => (
                                                <li key={symptom.slug}>
                                                    <Link href={`/check/${symptom.slug}`} className="text-blue-600 hover:text-blue-800 hover:underline block">
                                                        {symptom.name}
                                                    </Link>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Cats Column */}
                    <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                        <div className="px-4 py-5 sm:px-6 bg-green-600">
                            <h2 className="text-xl leading-6 font-medium text-white">Cats</h2>
                            <p className="mt-1 max-w-2xl text-sm text-green-100">Common symptoms in cats</p>
                        </div>
                        <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
                            {Object.entries(symptoms.Cat).length === 0 ? (
                                <p className="text-gray-500 italic">No cat symptoms found.</p>
                            ) : (
                                Object.entries(symptoms.Cat).map(([letter, list]) => (
                                    <div key={`cat-${letter}`} className="mb-6">
                                        <h3 className="text-lg font-bold text-gray-800 border-b border-gray-200 mb-2">{letter}</h3>
                                        <ul className="space-y-1">
                                            {list.map((symptom) => (
                                                <li key={symptom.slug}>
                                                    <Link href={`/check/${symptom.slug}`} className="text-green-600 hover:text-green-800 hover:underline block">
                                                        {symptom.name}
                                                    </Link>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
