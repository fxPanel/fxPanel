/**
 * Parses a resource name and version from a string like monitor/v7.2.0
 */
export const parseResourceNameVerion = (res: string) => {
    const index = res.indexOf('/');
    if (index === -1) {
        return { name: res };
    }
    const versionStr = res.substring(index + 1);
    return {
        name: res.substring(0, index),
        version: versionStr ? versionStr : undefined,
    };
};

/**
 * Process resource changes and return removed, added and updated resources
 */
export const processResourceChanges = (
    removed: string[],
    added: string[],
): { removed: string[]; added: string[]; updated: PackageChange[] } => {
    const removedResources = removed.map(parseResourceNameVerion);
    const addedResources = added.map(parseResourceNameVerion);

    const removedNames = new Set(removedResources.map((res) => res.name));
    const addedNames = new Set(addedResources.map((res) => res.name));
    const addedResourceByName = new Map(addedResources.map((resource) => [resource.name, resource]));

    const removedOnly: string[] = [];
    const addedOnly: string[] = [];
    const updated: PackageChange[] = [];

    for (const resource of removedResources) {
        if (!addedNames.has(resource.name)) {
            removedOnly.push(resource.version ? `${resource.name}/${resource.version}` : resource.name);
            continue;
        }

        const newResource = addedResourceByName.get(resource.name);
        updated.push({
            resName: resource.name,
            oldVer: resource.version ?? '???',
            newVer: newResource?.version ?? '???',
        });
    }

    for (const resource of addedResources) {
        if (!removedNames.has(resource.name)) {
            addedOnly.push(resource.version ? `${resource.name}/${resource.version}` : resource.name);
        }
    }

    return {
        removed: removedOnly,
        added: addedOnly,
        updated,
    };
};

type PackageChange = {
    resName: string;
    oldVer: string;
    newVer: string;
};

/**
 *  Check if a character is alphanumeric
 */
const isCharAlphaNum = (ch: number) =>
    (ch >= 0x30 && ch <= 0x39) || // 0-9
    (ch >= 0x41 && ch <= 0x5a) || // A-Z
    (ch >= 0x61 && ch <= 0x7a); // a-z

/**
 * Get the common prefix of two strings
 */
const getCommonPrefix = (input1: string, input2: string) => {
    let length = 0;
    //find the length of the common prefix
    while (length < input1.length && length < input2.length && input1[length] === input2[length]) {
        length++;
    }

    //backtrack until it finds the last separator character
    while (
        length > 0 &&
        (isCharAlphaNum(input2.charCodeAt(length)) || !isCharAlphaNum(input2.charCodeAt(length - 1)))
    ) {
        length--;
    }

    if (length <= 1) {
        return false;
    } else {
        return input2.slice(0, length);
    }
};

/**
 * Split an array of strings into prefixed strings
 */
export const splitPrefixedStrings = (strings: string[]): PrefixedString[] => {
    return strings.map((str, i) => {
        const prefix = i === 0 ? false : getCommonPrefix(strings[i - 1], str);
        return {
            prefix,
            suffix: prefix ? str.slice(prefix.length) : str,
        };
    });
};

export type PrefixedString = {
    prefix: string | false;
    suffix: string;
};

/**
 * Compress MultipleCounter array up to a desired length by dropping the elements with fewer counts
 */
export const compressMultipleCounter = (
    data: [reasonType: string, count: number][],
    targetLength: number,
    crashesGroupReasons: boolean,
) => {
    //Cutoff count
    if (data.length <= targetLength) {
        return {
            filteredIn: data,
            filteredOut: false as const,
        };
    }

    const topCounts: number[] = [];
    for (const [, count] of data) {
        let insertIndex = topCounts.length;
        for (let i = 0; i < topCounts.length; i++) {
            if (count > topCounts[i]) {
                insertIndex = i;
                break;
            }
        }
        if (insertIndex >= targetLength) {
            continue;
        }

        topCounts.splice(insertIndex, 0, count);
        if (topCounts.length > targetLength) {
            topCounts.pop();
        }
    }
    const cutoff = topCounts[targetLength - 1] ?? topCounts[topCounts.length - 1] ?? 0;

    let filteredOutTypes = 0;
    let filteredOutCounts = 0;
    const filteredIn: [reasonType: string, count: number][] = [];
    for (let i = 0; i < data.length; i++) {
        const [key, count] = data[i];
        const shouldDisplay = crashesGroupReasons ? count >= cutoff : i < targetLength;
        if (shouldDisplay) {
            filteredIn.push([key, count]);
        } else {
            filteredOutTypes++;
            filteredOutCounts += count;
        }
    }

    return {
        filteredIn,
        filteredOut: !!filteredOutTypes && {
            count: filteredOutCounts,
            types: filteredOutTypes,
        },
    };
};
