import json
import sys


SYMPTOM_RULES = [
    ({"cough", "high_fever", "headache"}, "Flu"),
    ({"cough", "chest_pain", "breathlessness"}, "Common Cold"),
    ({"itching", "skin_rash", "red_spots_over_body"}, "Allergy"),
    ({"headache", "nausea", "vomiting"}, "Migraine"),
    ({"joint_pain", "muscle_weakness", "fatigue"}, "Arthritis"),
    ({"fatigue", "weight_loss", "restlessness"}, "Diabetes"),
    ({"burning_micturition", "bladder_discomfort", "continuous_feel_of_urine"}, "Urinary tract infection"),
    ({"acidity", "stomach_pain", "vomiting"}, "GERD"),
]


def predict(symptoms):
    normalized = [str(item).strip().lower() for item in symptoms if str(item).strip()]
    recognized = sorted(set(normalized))

    best_match = ("Common Cold", 0)
    symptom_set = set(recognized)

    for required, disease in SYMPTOM_RULES:
        score = len(symptom_set.intersection(required))
        if score > best_match[1]:
            best_match = (disease, score)

    return {
        "disease": best_match[0],
        "recognizedSymptoms": recognized,
    }


if __name__ == "__main__":
    payload = json.loads(sys.argv[1]) if len(sys.argv) > 1 else []
    print(json.dumps(predict(payload)))
