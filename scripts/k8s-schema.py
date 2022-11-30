import json
import argparse
from os import path

def iterd(d):
    if type(d) == dict:
        for k, v in d.items():
            if type(v) in [dict, list]:
                for dic, key, val in iterd(v):
                    yield dic, key, val
            else:
                yield d, k, v
    if type(d) is list:
        for k, v in enumerate(d):
            if type(v) in [dict, list]:
                for dic, key, val in iterd(v):
                    yield dic, key, val
            else:
                yield d, k, v

def iter_change_ref(d, s):
    for di, k, v in iterd(d):
       if k == "$ref":
           if v.startswith(s):
               di[k] = v[len(s):]


def main(root_dir, out="k8s-schema.json"):
    with open(path.join(root_dir, "_definitions.json")) as f:
        defs = json.load(f)
        defs = defs["definitions"]
    
    with open(path.join(root_dir, "all.json")) as f:
        a = json.load(f)
    
    # iter_change_ref(defs, "#/definitions/")
    iter_change_ref(a, "_definitions.json")
    # a["definitions"] = defs["definitions"]

    for name, schema in defs.items():
        # remove multiple matches
        if "properties" not in schema:
            a["oneOf"].remove({"$ref": f'#/definitions/{name}'})
        
        # Fix apiVersion + kind + group enums
        kg = schema.get("x-kubernetes-group-version-kind")
        if kg and len(kg) == 1:
            schema["properties"]["kind"]["enum"] = [kg[0]["kind"]]
            kind = kg[0]["group"] + "/" + kg[0]["version"] if kg[0]["group"] else kg[0]["version"]
            schema["properties"]["apiVersion"]["enum"] = [kind]
        
    
    a["definitions"] = defs
    with open(out, 'w') as f:
        json.dump(a, f)



if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("root_dir", help="openapi2jsonschema output directory")
    parser.add_argument("-o","--out", default="k8s-schema.json")
    args = parser.parse_args()
    main(args.root_dir, args.out)

