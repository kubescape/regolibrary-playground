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
    
    with open(path.join(root_dir, "all.json")) as f:
        a = json.load(f)
    
    iter_change_ref(defs, "#/definitions/")
    iter_change_ref(a, "_definitions.json#/definitions/")

    defs = [{"uri": k,"fileMatch":[], "schema": v} for k, v in defs["definitions"].items()]

    # remove multiple matches
    for i in defs:
        if "properties" not in i["schema"]:
            a["oneOf"].remove({"$ref": i['uri']})
    
    for i in defs:
        kg = i["schema"].get("x-kubernetes-group-version-kind")
        if kg and len(kg) == 1:
            i["schema"]["properties"]["kind"]["enum"] = [kg[0]["kind"]]
            kind = kg[0]["group"] + "/" + kg[0]["version"] if kg[0]["group"] else kg[0]["version"]
            i["schema"]["properties"]["apiVersion"]["enum"] = [kind]
    
    schema = defs + [{"schema": a, "uri":"k8s", "fileMatch": ["*"]}]

    with open(out, 'w') as f:
        json.dump(schema, f)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("root_dir", help="openapi2jsonschema output directory")
    parser.add_argument("-o","--out", default="k8s-schema.json")
    args = parser.parse_args()
    main(args.root_dir, args.out)

