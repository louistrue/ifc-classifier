import fs from 'fs';
import path from 'path';
import https from 'https';
import { URL } from 'url';

interface IfcClassData {
    en: string;
    de: string;
    schema: string;
}

interface IfcClasses {
    [key: string]: IfcClassData;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Common variables used across functions
const baseUrl = 'https://ifc43-docs.standards.buildingsmart.org/IFC/RELEASE/IFC4x3/HTML';
const docsDir = path.join(process.cwd(), 'public', 'ifc-docs');
const updatedPath = path.join(process.cwd(), 'public', 'data', 'natural_ifcclass_local.json');

async function downloadFile(url: string, outputPath: string): Promise<boolean> {
    return new Promise((resolve) => {
        console.log(`📥 Downloading: ${url}`);

        const file = fs.createWriteStream(outputPath);

        https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
            }
        }, (response) => {
            if (response.statusCode === 200) {
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    console.log(`✅ Downloaded: ${path.basename(outputPath)}`);
                    resolve(true);
                });
            } else if (response.statusCode === 301 || response.statusCode === 302) {
                file.close();
                fs.unlinkSync(outputPath);

                const redirectUrl = response.headers.location;
                if (redirectUrl) {
                    console.log(`🔄 Redirecting to: ${redirectUrl}`);
                    downloadFile(redirectUrl, outputPath).then(resolve);
                } else {
                    console.error(`❌ Redirect without location header for ${url}`);
                    resolve(false);
                }
            } else {
                console.error(`❌ Failed to download ${url}: HTTP ${response.statusCode} ${response.statusMessage}`);
                file.close();
                if (fs.existsSync(outputPath)) {
                    fs.unlinkSync(outputPath);
                }
                resolve(false);
            }
        }).on('error', (err) => {
            console.error(`❌ Error downloading ${url}:`, err.message);
            file.close();
            if (fs.existsSync(outputPath)) {
                fs.unlinkSync(outputPath);
            }
            resolve(false);
        });
    });
}

async function downloadIfcDocumentation() {
    console.log('🚀 Starting IFC Documentation Download');
    console.log('📊 Source: https://standards.buildingsmart.org/IFC/RELEASE/IFC4_3/');

    // Read the IFC classes data
    const ifcClassesPath = path.join(process.cwd(), 'public', 'data', 'natural_ifcclass.json');

    if (!fs.existsSync(ifcClassesPath)) {
        console.error(`❌ File not found: ${ifcClassesPath}`);
        process.exit(1);
    }

    const ifcClasses: IfcClasses = JSON.parse(fs.readFileSync(ifcClassesPath, 'utf8'));
    console.log(`📋 Found ${Object.keys(ifcClasses).length} IFC classes to download`);

    // Create local documentation directory
    if (!fs.existsSync(docsDir)) {
        fs.mkdirSync(docsDir, { recursive: true });
        console.log(`📁 Created directory: ${docsDir}`);
    }

    // Create a manifest file to track what we've downloaded
    const manifestPath = path.join(docsDir, 'manifest.json');
    const manifest: Record<string, any> = {
        downloadDate: new Date().toISOString(),
        source: 'https://ifc43-docs.standards.buildingsmart.org/IFC/RELEASE/IFC4x3/HTML/',
        classes: {}
    };

    // Download each IFC class documentation
    const entries = Object.entries(ifcClasses);
    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < entries.length; i++) {
        const [className, data] = entries[i];
        const filename = `${className}.html`;
        const outputPath = path.join(docsDir, filename);

        console.log(`\n📄 Processing ${i + 1}/${entries.length}: ${className}`);

        // Skip if file already exists and is not empty
        if (fs.existsSync(outputPath)) {
            const stats = fs.statSync(outputPath);
            if (stats.size > 1000) { // File exists and has content
                console.log(`⏭️ Skipping existing: ${filename} (${Math.round(stats.size / 1024)}KB)`);
                manifest.classes[className] = {
                    filename,
                    size: stats.size,
                    status: 'exists'
                };
                skippedCount++;
                continue;
            }
        }

        const success = await downloadFile(data.schema, outputPath);

        if (success) {
            const stats = fs.statSync(outputPath);
            manifest.classes[className] = {
                filename,
                originalUrl: data.schema,
                size: stats.size,
                status: 'downloaded'
            };
            successCount++;
        } else {
            manifest.classes[className] = {
                filename,
                originalUrl: data.schema,
                status: 'failed'
            };
            failCount++;
        }

        // Be respectful to the server - wait between downloads
        if (i < entries.length - 1) {
            console.log(`⏳ Waiting 3 seconds before next download...`);
            await delay(3000);
        }
    }

    // Save manifest
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`\n📋 Manifest saved: ${manifestPath}`);

    console.log(`\n📊 Download Summary:`);
    console.log(`✅ Successful: ${successCount}`);
    console.log(`⏭️ Skipped (existing): ${skippedCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`📁 Files location: ${docsDir}`);

    // Create updated JSON file with local paths
    const updatedIfcClasses: IfcClasses = {};
    for (const [className, data] of Object.entries(ifcClasses)) {
        updatedIfcClasses[className] = {
            ...data,
            schema: `/ifc-docs/${className}.html`
        };
    }

    // Save updated JSON file
    fs.writeFileSync(updatedPath, JSON.stringify(updatedIfcClasses, null, 2));
    console.log(`\n📝 Updated IFC classes file: ${updatedPath}`);

    console.log(`\n🎉 Download complete! Total files: ${successCount + skippedCount}`);

    if (failCount > 0) {
        console.log(`⚠️  ${failCount} downloads failed. You can retry by running the script again.`);
    }
}

async function downloadImages(): Promise<void> {
    console.log('\n📸 === Downloading Image Assets ===');

    const figuresDir = path.join(docsDir, 'figures');
    if (!fs.existsSync(figuresDir)) {
        fs.mkdirSync(figuresDir, { recursive: true });
    }

    // Common image files referenced in IFC documentation
    const commonImages = [
        // Building element images
        'ifcbuildingelement-brep-layout1.gif',
        'ifcbuildingelement-surfacemodel-layout1.gif',
        'ifcbuildingelement-boundingbox-layout1.gif',

        // Wall images
        'ifcwallstandard_straigthwall_01-layout1.gif',
        'ifcwallstandard_curvedwall_01-layout1.gif',
        'ifcwallstandard_straigthwall_02-layout1.gif',
        'ifcwallstandard_curvedwall_02-layout1.gif',
        'ifcwallstandard_straigthwall_03-layout1.gif',
        'ifcwallstandard_curvedwall_03-layout1.gif',
        'ifcwall-partitioning.png',
        'ifcwall_materialusage-01.png',
        'ifcmateriallayersetusage_wall-01.png',

        // Slab images
        'ifcslab_standardcase-01.png',
        'ifcslab_elementedcase-01.png',

        // Beam and column images
        'ifcbeam-layout1.gif',
        'ifcbeam_straigthbeam_01-layout1.gif',
        'ifccolumn_straigthcolumn_01-layout1.gif',

        // Door and window images
        'ifcdoor-layout1.gif',
        'ifcwindow-layout1.gif',

        // Project images
        'ifcproject_fig-1.png',
        'ifcproject_fig-2.png',
        'ifcproject-layout1.gif',

        // Building images
        'ifcbuilding_fig-1.png',
        'ifcbuilding-layout1.gif',

        // Site images
        'ifcsite_fig-1.png',
        'ifcsite-layout1.gif',

        // Space images
        'ifcspace-layout1.gif',
        'ifcspace_fig-1.png'
    ];

    let downloadedCount = 0;
    let skippedCount = 0;

    for (const imageName of commonImages) {
        const imageUrl = `${baseUrl}/figures/${imageName}`;
        const outputPath = path.join(figuresDir, imageName);

        // Skip if already exists
        if (fs.existsSync(outputPath)) {
            console.log(`⏭️  Skipping existing: ${imageName}`);
            skippedCount++;
            continue;
        }

        const success = await downloadFile(imageUrl, outputPath);
        if (success) {
            downloadedCount++;
        }

        // Be respectful to the server
        await delay(200);
    }

    console.log(`\n📊 Image Download Summary:`);
    console.log(`✅ Downloaded: ${downloadedCount} images`);
    console.log(`⏭️  Skipped: ${skippedCount} images`);
}

async function main(): Promise<void> {
    try {
        console.log('🚀 Starting IFC Documentation Download...');

        await downloadIfcDocumentation();
        await downloadImages();

        console.log('\n🎉 === Download Complete! ===');
        console.log(`📁 Documentation saved to: ${docsDir}`);
        console.log(`📄 Local mapping file: ${updatedPath}`);
        console.log('\n🔥 Ready to use local IFC documentation!');
    } catch (error) {
        console.error('❌ Download failed:', error);
        process.exit(1);
    }
}

// Run the download
main()
    .then(() => {
        console.log('\n✨ IFC documentation download completed successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Error:', error);
        process.exit(1);
    }); 