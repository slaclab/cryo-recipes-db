TAG=20200514.0

docker:
	sudo docker build . -t slaclab/cryo-recipes-db:${TAG}
	sudo docker push slaclab/cryo-recipes-db:${TAG}
