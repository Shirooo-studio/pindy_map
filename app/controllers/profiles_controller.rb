class ProfilesController < ApplicationController
  before_action :authenticate_user!

  def new
    redirect_to root_path and return if current_user.profile_completed?
    @user = current_user
  end

  def create
    @user = current_user
    if @user.update(profile_params.merge(profile_completed: true))
      redirect_to root_path, notice: "アカウント情報を登録しました。"
    else
      render :new, status: :unprocessable_entity
    end
  end

  def edit
    @user = current_user
  end

  def update
    @user = current_user
    if @user.update(profile_params)
      redirect_to root_path, notice: "更新しました。"
    else
      render :edit, status: :unprocessable_entity
    end
  end

  private
  def profile_params
    params.require(:user).permit(:username, :full_name, :company, :work_location, :department)
  end
end
