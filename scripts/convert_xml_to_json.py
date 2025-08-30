import xml.etree.ElementTree as ET
import json
import random
import os

def generate_random_hex_color():
    return f"#{random.randint(0, 0xFFFFFF):06x}"

def extract_items_from_xml(element, classifications_list):
    """
    Recursively extract only the lowest level Item elements from the XML hierarchy.
    Only extracts items that have no children or empty children.
    Handles both CFC and eCCC-Bat XML formats.
    """
    for item in element.findall('.//Item'):
        # Check if this item has children
        children = item.find('Children')
        has_children = (children is not None and len(children) > 0)

        # Only process items that have no children (lowest level)
        if not has_children:
            item_id = item.find('ID')
            item_name = item.find('Name')

            if item_id is not None and item_id.text:
                id_text = item_id.text.strip()

                # Check if this is CFC format (ID contains both code and name)
                if item_name is None or not item_name.text or item_name.text.strip() == '':
                    # CFC format: "0 Terrain" -> split by first space
                    parts = id_text.split(' ', 1)
                    if len(parts) >= 2:
                        code = parts[0]
                        name = parts[1]
                    else:
                        code = id_text
                        name = id_text
                else:
                    # eCCC-Bat format: ID is code, Name is name
                    code = id_text
                    name = item_name.text.strip()

                # Only add if we have valid code and name
                if code and name:
                    classifications_list.append({
                        "code": code,
                        "name": name,
                        "color": generate_random_hex_color(),
                        "elements": []
                    })

def convert_xml_to_json(xml_file_path, json_file_path):
    """
    Converts XML classification files to JSON format.
    Supports both CFC and eCCC-Bat XML structures.
    """
    classifications = []
    
    try:
        # Parse the XML file
        tree = ET.parse(xml_file_path)
        root = tree.getroot()
        
        # Extract all classification items
        extract_items_from_xml(root, classifications)
        
        print(f"Successfully parsed XML file. Found {len(classifications)} classification items.")
        
        if not classifications:
            print("Warning: No classification items were extracted from the XML file.")
            return
            
    except ET.ParseError as e:
        print(f"Error parsing XML file: {e}")
        return
    except FileNotFoundError:
        print(f"Error: XML file not found at {xml_file_path}")
        return
    except Exception as e:
        print(f"An error occurred while processing the XML file: {e}")
        return

    try:
        # Ensure the directory exists
        os.makedirs(os.path.dirname(json_file_path), exist_ok=True)
        
        # Write the JSON file
        with open(json_file_path, 'w', encoding='utf-8') as json_file:
            json.dump(classifications, json_file, indent=2, ensure_ascii=False)
        
        print(f"Successfully converted {xml_file_path} to {json_file_path}")
        print(f"Created {len(classifications)} classification entries")
        
    except Exception as e:
        print(f"Error writing JSON file: {e}")

if __name__ == "__main__":
    # Convert CFC classification
    cfc_xml = "public/data/classification CFC.xml"
    cfc_json = "public/data/cfc.json"
    print(f"Converting CFC XML to JSON...")
    print(f"Input: {cfc_xml}")
    print(f"Output: {cfc_json}")
    convert_xml_to_json(cfc_xml, cfc_json)
    
    print("\n" + "="*50 + "\n")
    
    # Convert eCCC-Bat classification
    eccc_xml = "public/data/classification eccc_bat.xml"
    eccc_json = "public/data/eccc_bat.json"
    print(f"Converting eCCC-Bat XML to JSON...")
    print(f"Input: {eccc_xml}")
    print(f"Output: {eccc_json}")
    convert_xml_to_json(eccc_xml, eccc_json)