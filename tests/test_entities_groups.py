from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)


def test_entities_and_groups_scoped_by_job():
    job1 = "job1"
    job2 = "job2"
    # create entities for each job
    e1 = {"id": "e1", "type": "NAME", "value": "Alice"}
    e2 = {"id": "e2", "type": "NAME", "value": "Bob"}
    client.post(f"/entities/{job1}", json=e1)
    client.post(f"/entities/{job2}", json=e2)

    res1 = client.get(f"/entities/{job1}").json()
    res2 = client.get(f"/entities/{job2}").json()
    assert [ent["id"] for ent in res1] == ["e1"]
    assert [ent["id"] for ent in res2] == ["e2"]

    # create group for job1 and assign entity
    g1 = {"id": "g1", "name": "G1", "entities": []}
    client.post(f"/groups/{job1}", json=g1)
    client.post(f"/groups/{job1}/g1/entities/e1")

    groups_job1 = client.get(f"/groups/{job1}").json()
    groups_job2 = client.get(f"/groups/{job2}").json()
    assert groups_job1[0]["entities"] == ["e1"]
    assert groups_job2 == []
